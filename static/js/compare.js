/* =========================================================
   특수 길잡이 — 학교 비교 모달
   AI 추천 3곳을 한 화면에서 항목별로 비교
   ---------------------------------------------------------
   ✨ 변경점: 매칭 점수를 단일 숫자가 아니라
      "가중합 산출 내역"으로 분해해 시각화한다.
      → 데모 화면이 제안서의 점수 산식 그래프와 일치하게 됨
   ========================================================= */

/* ----------------------------------------------------------
   비교 항목 정의
   - key:   학교 객체에서 꺼내올 필드명
   - label: 화면에 표시할 한글 라벨
   - icon:  시각적 구분용 이모지
   - winnerRule: 어떤 값이 "최우수"인지 판단하는 규칙
       'min'    → 작을수록 좋음 (예: 통학 시간, 교사당 학생 수)
       'max'    → 클수록 좋음   (예: 매칭 점수)
       'none'   → 우열 판단 안 함 (단순 정보)
---------------------------------------------------------- */
const COMPARE_FIELDS = [
    { key: 'match_score',       label: '매칭 점수',    icon: '🎯', winnerRule: 'max', unit: '점',  highlight: true },
    { key: 'commute_time_min',  label: '통학 시간',    icon: '🚌', winnerRule: 'min', unit: '분' },
    { key: 'disability_focus',  label: '주요 장애영역', icon: '🧩', winnerRule: 'none' },
    { key: 'class_size',        label: '교사당 학생',  icon: '👥', winnerRule: 'min', unit: '명' },
    { key: 'afterschool_summary', label: '방과후 프로그램', icon: '🎨', winnerRule: 'none' },
    { key: 'founder',           label: '설립 구분',    icon: '🏛️', winnerRule: 'none' },
];

/* ==========================================================
   🎯 매칭 점수 산출 모델 (100점 만점 가중합)
   - max:    이 항목이 가질 수 있는 최대 배점
   - source: 'data'    → 학교알리미 등 공공데이터에서 직접 산출
             'profile' → 입력된 아동 프로필 기반 (시연 시나리오 값)
   제안서의 "AI 활용 과정 ③" 표와 동일한 구조를 의도적으로 맞춤.
   ========================================================== */
const SCORE_MODEL = [
    { key: 'disability',  label: '장애유형 적합도', icon: '🧩', max: 30, source: 'profile' },
    { key: 'course',      label: '희망 과정 개설',  icon: '🎓', max: 25, source: 'profile' },
    { key: 'commute',     label: '통학 부담',       icon: '🚌', max: 20, source: 'data' },
    { key: 'classSize',   label: '학급 규모',       icon: '👥', max: 15, source: 'data' },
    { key: 'afterschool', label: '방과후 충족도',   icon: '🎨', max: 10, source: 'data' },
];

/* 0~1 범위로 자르기 */
function clamp01(x) { return Math.max(0, Math.min(1, x)); }

/* 방과후 요약 텍스트 → 0~1 충족 점수 (데모용 매핑) */
function afterschoolSubScore(summary) {
    if (!summary) return 0.5;
    if (summary.includes('종일')) return 1.0;
    if (summary.includes('특기')) return 0.85;
    if (summary.includes('교과')) return 0.7;
    return 0.5;
}

/* ----------------------------------------------------------
   학교 1곳의 매칭 점수 산출 내역 계산
   - 통학·학급·방과후 : 학교 데이터에서 직접 산출
   - 장애적합·과정    : 아동 프로필 기반
       · school.profile_fit (0~1)  → 없으면 0.85 기본값
       · school.course_open (bool) → false일 때만 미개설(0점)
   반환: { items: [...], total }  (total = 화면에 표시할 매칭 점수)
---------------------------------------------------------- */
function computeBreakdown(school) {
    const sub = {
        disability:  clamp01(school.profile_fit ?? 0.85),
        course:      (school.course_open === false) ? 0 : 1,
        commute:     clamp01(1 - (school.commute_time_min ?? 60) / 60),
        classSize:   clamp01((8 - (school.class_size ?? 8)) / 5),
        afterschool: afterschoolSubScore(school.afterschool_summary),
    };

    const items = SCORE_MODEL.map(m => {
        const s = sub[m.key];
        return {
            ...m,
            subScore: s,
            points: Math.round(s * m.max * 10) / 10,   // 소수 1자리
        };
    });

    const total = Math.round(items.reduce((acc, it) => acc + it.points, 0));
    return { items, total };
}

/* ----------------------------------------------------------
   매칭 점수 → 색상 매핑 (그라데이션)
   90+ : 코랄 (최우수)
   80~89: 앰버
   70~79: 인디고
   미만: 그레이
---------------------------------------------------------- */
function scoreColor(score) {
    if (score >= 90) return { main: 'var(--coral)',  soft: 'var(--coral-soft)',  glow: 'rgba(255, 90, 95, 0.30)' };
    if (score >= 80) return { main: 'var(--amber)',  soft: 'var(--amber-soft)',  glow: 'rgba(255, 179, 71, 0.30)' };
    if (score >= 70) return { main: 'var(--indigo)', soft: '#A5A6F6',            glow: 'rgba(79, 70, 229, 0.30)' };
    return { main: 'var(--ink-soft)', soft: 'var(--ink-faint)', glow: 'rgba(107, 114, 128, 0.20)' };
}

/* ----------------------------------------------------------
   각 항목별 "최우수" 학교 인덱스를 찾는 함수
   동률일 경우 가장 먼저 등장한 학교 반환
---------------------------------------------------------- */
function findWinnerIdx(schools, field) {
    if (field.winnerRule === 'none') return -1;

    let bestIdx = 0;
    let bestVal = schools[0][field.key];

    for (let i = 1; i < schools.length; i++) {
        const v = schools[i][field.key];
        if (field.winnerRule === 'max' && v > bestVal) {
            bestVal = v; bestIdx = i;
        } else if (field.winnerRule === 'min' && v < bestVal) {
            bestVal = v; bestIdx = i;
        }
    }
    return bestIdx;
}

/* ----------------------------------------------------------
   값 포맷팅 (단위 붙이기, 안전 처리)
---------------------------------------------------------- */
function formatValue(value, field) {
    if (value === undefined || value === null || value === '') return '-';
    if (field.unit && typeof value === 'number') return `${value}${field.unit}`;
    return value;
}

/* ----------------------------------------------------------
   🎯 매칭 점수 산출 내역 카드 렌더링
   - bd: computeBreakdown() 결과
   - sc: scoreColor() 결과 (막대 색상 통일용)
---------------------------------------------------------- */
function renderBreakdown(bd, sc) {
    const rows = bd.items.map(it => {
        const pct = it.max > 0 ? (it.points / it.max) * 100 : 0;

        // 출처 태그 스타일
        const isData = it.source === 'data';
        const tagBg   = isData ? 'rgba(79,70,229,0.10)'  : 'rgba(255,179,71,0.20)';
        const tagInk  = isData ? '#4F46E5'               : '#B45309';
        const tagText = isData ? '학교데이터'             : '아동 프로필';

        return `
            <div style="margin-bottom:9px;">
                <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
                    <span style="font-size:12px;color:#374151;flex:1;">${it.icon} ${it.label}</span>
                    <span style="font-size:10px;font-weight:700;padding:1px 6px;border-radius:6px;background:${tagBg};color:${tagInk};">${tagText}</span>
                    <span style="font-size:12px;font-weight:700;color:#111827;min-width:46px;text-align:right;">${it.points} / ${it.max}</span>
                </div>
                <div style="height:6px;background:rgba(17,24,39,0.07);border-radius:3px;overflow:hidden;">
                    <div style="height:100%;width:${pct}%;background:${sc.main};border-radius:3px;"></div>
                </div>
            </div>
        `;
    }).join('');

    return `
        <div class="compare_breakdown" style="margin-top:14px;padding:14px 16px;background:#FAFAFB;border:1px solid rgba(17,24,39,0.06);border-radius:14px;">
            <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px;">
                <span style="font-size:12px;font-weight:700;color:#6B7280;letter-spacing:.02em;">매칭 점수 산출 내역</span>
                <span style="font-size:11px;color:#9CA3AF;">가중합 · 100점 만점</span>
            </div>
            ${rows}
            <div style="display:flex;justify-content:flex-end;align-items:baseline;gap:6px;margin-top:10px;padding-top:8px;border-top:1px dashed rgba(17,24,39,0.12);">
                <span style="font-size:12px;color:#6B7280;">합계</span>
                <span style="font-size:15px;font-weight:800;color:${sc.main};">${bd.total}점</span>
            </div>
        </div>
    `;
}

/* ----------------------------------------------------------
   비교 모달 열기
   - schools: AI가 추천한 학교 배열 (최대 3개)
---------------------------------------------------------- */
function openCompareModal(schools) {
    const modal = document.getElementById('compare_modal');
    if (!modal || !schools || schools.length === 0) return;

    // 🎯 각 학교의 매칭 점수를 산식으로 재계산해 enriched 사본 생성
    //    (원본 객체는 건드리지 않음 — 산출 total을 match_score로 덮어씀)
    const enriched = schools.map(s => {
        const bd = computeBreakdown(s);
        return { ...s, match_score: bd.total, _breakdown: bd };
    });

    // 각 항목별 우승자 미리 계산
    const winners = COMPARE_FIELDS.map(f => findWinnerIdx(enriched, f));

    // 학교별 컬럼(카드) 생성
    const columns = enriched.map((school, idx) => {
        const sc = scoreColor(school.match_score ?? 0);

        // 비교 행 렌더링
        const rows = COMPARE_FIELDS.map((field, fIdx) => {
            const value = formatValue(school[field.key], field);
            const isWinner = winners[fIdx] === idx;

            // 매칭 점수는 별도 큰 시각화 영역으로 처리 → 행에서는 제외
            if (field.highlight) return '';

            return `
                <div class="compare_row ${isWinner ? 'compare_row--winner' : ''}">
                    <div class="compare_row_label">
                        <span class="compare_row_icon">${field.icon}</span>
                        <span>${field.label}</span>
                    </div>
                    <div class="compare_row_value">
                        ${isWinner ? '<span class="compare_winner_star" aria-label="이 항목 최우수">⭐</span>' : ''}
                        <span>${value}</span>
                    </div>
                </div>
            `;
        }).join('');

        // 추천 근거 (filter.js의 reason 필드)
        const reason = school.reason ? `
            <div class="compare_reason">
                <span class="compare_reason_label">AI 추천 근거</span>
                <p>${school.reason}</p>
            </div>
        ` : '';

        return `
            <div class="compare_col" data-idx="${idx}">
                <div class="compare_col_header">
                    <div class="compare_rank_badge"
                         style="background: linear-gradient(135deg, ${sc.main}, ${sc.soft}); box-shadow: 0 4px 12px ${sc.glow};">
                        추천 ${idx + 1}
                    </div>
                    <h3 class="compare_school_name">${school.name}</h3>
                    <p class="compare_school_address">${school.address ?? ''}</p>
                </div>

                <div class="compare_score_box" style="background: linear-gradient(135deg, ${sc.main} 0%, ${sc.soft} 100%); box-shadow: 0 8px 24px ${sc.glow};">
                    <span class="compare_score_label">매칭 점수</span>
                    <div class="compare_score_value">
                        <span class="compare_score_num">${school.match_score ?? '-'}</span>
                        <span class="compare_score_unit">점</span>
                    </div>
                    <div class="compare_score_bar">
                        <div class="compare_score_bar_fill" style="width: ${Math.max(0, Math.min(100, school.match_score ?? 0))}%;"></div>
                    </div>
                </div>

                ${renderBreakdown(school._breakdown, sc)}

                <div class="compare_rows">
                    ${rows}
                </div>

                ${reason}

                <button class="compare_select_btn" data-idx="${idx}">
                    이 학교 자세히 보기 →
                </button>
            </div>
        `;
    }).join('');

    // 모달 본문 채우기
    const body = modal.querySelector('.compare_body');
    body.innerHTML = `
        <div class="compare_intro">
            <h2>추천 학교 한눈에 비교</h2>
            <p>매칭 점수는 5개 항목 가중합으로 산출되며, 항목별 최우수 학교는 ⭐ 로 표시됩니다.</p>
        </div>
        <div class="compare_grid">${columns}</div>
    `;

    // 선택 시 원본 학교 객체를 넘기기 위해 enriched 저장
    window.currentCompareSchools = enriched;

    // 모달 열기
    modal.classList.remove('hidden');
    requestAnimationFrame(() => modal.classList.add('active'));

    // ESC 키로 닫기
    document.addEventListener('keydown', escHandler);
}

function closeCompareModal() {
    const modal = document.getElementById('compare_modal');
    if (!modal) return;
    modal.classList.remove('active');
    setTimeout(() => modal.classList.add('hidden'), 300);
    document.removeEventListener('keydown', escHandler);
}

function escHandler(e) {
    if (e.key === 'Escape') closeCompareModal();
}

/* ----------------------------------------------------------
   "이 학교 자세히 보기" 클릭 핸들러
   비교 모달 닫고 → 기존 navigateToRecommendedSchool 호출
   (filter.js에서 정의된 함수 — 지도 이동 + 카드 오픈)
---------------------------------------------------------- */
function handleSelectFromCompare(idx) {
    const schools = window.currentCompareSchools || [];
    const school = schools[idx];
    if (!school) return;

    closeCompareModal();
    setTimeout(() => {
        if (typeof navigateToRecommendedSchool === 'function') {
            navigateToRecommendedSchool(school);
        } else if (typeof fillCard === 'function') {
            fillCard(school);
        }
    }, 320);
}

/* ----------------------------------------------------------
   초기화: 모달 닫기 버튼, 배경 클릭, 카드 선택 이벤트 위임
---------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('compare_modal');
    if (!modal) return;

    // 닫기 버튼
    const closeBtn = modal.querySelector('.compare_close_btn');
    if (closeBtn) closeBtn.addEventListener('click', closeCompareModal);

    // 배경 클릭으로 닫기
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeCompareModal();
    });

    // 카드 선택 (이벤트 위임)
    modal.addEventListener('click', (e) => {
        const btn = e.target.closest('.compare_select_btn');
        if (!btn) return;
        const idx = parseInt(btn.dataset.idx, 10);
        if (!isNaN(idx)) handleSelectFromCompare(idx);
    });
});

/* 전역 노출 — filter.js에서 호출 가능하도록 */
window.openCompareModal = openCompareModal;