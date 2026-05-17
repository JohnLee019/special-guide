const FIELD_MAP = {
    school_name:     "name",
    school_location: "address",
    school_number:   "tel",
    school_homepage: "homepage",
    school_type:     "founder",
    disable_type:    "disable_type"
};

let schoolChart = null;
let disabilityChart = null;

/* =========================================================
   브랜드 컬러 (style.css와 일치)
========================================================= */
const BRAND = {
    coral:      '#FF5A5F',
    coralSoft:  '#FF8589',
    amber:      '#FFB347',
    amberSoft:  '#FFD089',
    mint:       '#06D6A0',
    indigo:     '#4F46E5',
    violet:     '#8B5CF6',
    inkDeep:    '#0E1A2B',
    inkMid:     '#2D3748',
    inkSoft:    '#6B7280',
    bgCream:    '#FAF6F0',
};

// 차트 전반에 적용할 기본 폰트/색상
Chart.defaults.font.family = "'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, 'Apple SD Gothic Neo', sans-serif";
Chart.defaults.font.size = 11;
Chart.defaults.color = BRAND.inkMid;
Chart.defaults.borderColor = 'rgba(14, 26, 43, 0.06)';

/* 그라데이션 헬퍼 — 막대용 세로 그라데이션 */
function makeBarGradient(ctx, chartArea, colorTop, colorBottom) {
    if (!chartArea) return colorTop;
    const g = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
    g.addColorStop(0, colorTop);
    g.addColorStop(1, colorBottom);
    return g;
}

/* 학년별 고유 색상 — 막대 한 개당 다른 컬러 */
const LEVEL_COLORS = {
    '유치부': { top: '#FF5A5F', bot: '#FFB199', solid: '#FF5A5F' },  // coral
    '초등부': { top: '#FFB347', bot: '#FFE0A6', solid: '#FFB347' },  // amber
    '중등부': { top: '#06D6A0', bot: '#9CEFD2', solid: '#06D6A0' },  // mint
    '고등부': { top: '#4F46E5', bot: '#A5A6F6', solid: '#4F46E5' },  // indigo
    '전공과': { top: '#8B5CF6', bot: '#C4B5FD', solid: '#8B5CF6' },  // violet
};
function levelColorFor(label) {
    return LEVEL_COLORS[label] || { top: '#FF5A5F', bot: '#FFB199', solid: '#FF5A5F' };
}


/* =========================================================
   카드 채우기
========================================================= */
async function fillCard(school) {
    const card = document.querySelector(".card");
    for (const [elId, key] of Object.entries(FIELD_MAP)) {
        const value = school[key] ?? "";

        if (elId === "school_homepage") {
            const link = document.getElementById("school_homepage_link");
            if (value) {
                link.href = value.startsWith("http") ? value : `https://${value}`;
                link.innerText = value;
            } else {
                link.removeAttribute("href");
                link.innerText = "";
            }
        } else {
            document.getElementById(elId).innerText = value;
        }
    }
    const photo = document.getElementById("school_photo");
    photo.src = school.photo;
    photo.alt = `${school.name ?? ""} 사진`;

    // 🌟 시연용: 주몽학교 카드에서 '특기적성' 스탯을 누르면 해당 학교의 늘봄학교 페이지로 이동
    setupJumongAptitudeLink(school);

    card.classList.remove("hidden");
    card.classList.add("active");

    await fetchAndDrawChart(school);
}

/* 주몽학교 시연용 — '특기적성' stat 클릭 → 늘봄학교(방과후, 돌봄) 페이지 새 창 열기 */
function setupJumongAptitudeLink(school) {
    const aptStat = document.getElementById('stat_apt_pgm')?.closest('.stat');
    if (!aptStat) return;

    // 다른 학교로 전환됐을 때를 위해 일단 상태 리셋
    aptStat.classList.remove('stat-clickable');
    aptStat.onclick = null;
    aptStat.onkeydown = null;
    aptStat.removeAttribute('role');
    aptStat.removeAttribute('tabindex');
    aptStat.removeAttribute('title');

    if (school.name === '주몽학교') {
        aptStat.classList.add('stat-clickable');
        aptStat.setAttribute('role', 'link');
        aptStat.setAttribute('tabindex', '0');
        aptStat.setAttribute('title', '주몽학교 늘봄학교(방과후, 돌봄) 페이지 열기');
        const openLink = () => {
            window.open('https://jumong.sen.sc.kr/205232/subMenu.do', '_blank', 'noopener,noreferrer');
        };
        aptStat.onclick = openLink;
        aptStat.onkeydown = (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLink(); }
        };
    }
}


/* =========================================================
   메인 차트 (학년별 학생수 + 교사당 학생수)
========================================================= */
async function fetchAndDrawChart(school) {
    const canvas       = document.getElementById('school_chart');
    const chartSection = document.querySelector('.chart_section');
    const totalEl      = document.getElementById('total_students');

    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (schoolChart) schoolChart.destroy();

    const hideAll = () => {
        chartSection.style.display = 'none';
        totalEl.style.display = 'none';
    };

    if (!school.name) {
        hideAll();
        return;
    }

    try {
        const url = `/api/school_detail?school_name=${encodeURIComponent(school.name)}`;
        const res = await fetch(url);

        if (!res.ok) { hideAll(); return; }

        const detail = await res.json();

        if (detail.error) { hideAll(); return; }

        const levels = detail.levels;
        if (!levels || Object.keys(levels).length === 0) { hideAll(); return; }

        chartSection.style.display = 'block';
        totalEl.style.display = 'block';

        const total    = detail.total_students;
        const teachers = detail.teachers;
        totalEl.innerText = `총 학생수 ${total}명  ·  교사 ${teachers}명`;

        const LEVEL_ORDER = ["유치부", "초등부", "중등부", "고등부", "전공과"];
        const labels     = LEVEL_ORDER.filter(k => levels[k] !== undefined);
        const dataValues = labels.map(k => levels[k]);

        const spt = detail.students_per_teacher;

        const datasets = [
            {
                type: 'bar',
                label: '학년별 학생수',
                data: dataValues,
                // 🌟 핵심: 막대 한 개마다 학년별 고유 컬러 그라데이션 적용
                backgroundColor: (context) => {
                    const { ctx, chartArea } = context.chart;
                    if (!chartArea) return BRAND.coral;
                    const label = context.chart.data.labels[context.dataIndex];
                    const c = levelColorFor(label);
                    return makeBarGradient(ctx, chartArea, c.top, c.bot);
                },
                hoverBackgroundColor: (context) => {
                    const { ctx, chartArea } = context.chart;
                    if (!chartArea) return BRAND.coral;
                    const label = context.chart.data.labels[context.dataIndex];
                    const c = levelColorFor(label);
                    // 호버 시 더 진한 단색
                    return makeBarGradient(ctx, chartArea, c.solid, c.top);
                },
                borderWidth: 0,
                borderRadius: { topLeft: 10, topRight: 10, bottomLeft: 0, bottomRight: 0 },
                borderSkipped: false,
                barPercentage: 0.68,
                categoryPercentage: 0.82,
                yAxisID: 'y',
                order: 2,
            },
        ];

        if (spt && spt > 0) {
            datasets.push({
                type: 'line',
                label: `교사당 학생수 (${spt}명)`,
                data: labels.map(() => spt),
                borderColor: BRAND.indigo,
                backgroundColor: BRAND.indigo,
                borderWidth: 2.5,
                borderDash: [6, 5],
                pointRadius: 0,
                pointHoverRadius: 4,
                pointHoverBackgroundColor: BRAND.indigo,
                pointHoverBorderColor: '#fff',
                pointHoverBorderWidth: 2,
                fill: false,
                yAxisID: 'y1',
                order: 1,
                tension: 0,
            });
        }

        schoolChart = new Chart(ctx, {
            data: { labels, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 1000,
                    easing: 'easeOutQuart',
                },
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                layout: {
                    padding: { top: 12, right: 8, left: 4, bottom: 4 }
                },
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            boxWidth: 10,
                            boxHeight: 10,
                            padding: 12,
                            font: { size: 11, weight: '600' },
                            usePointStyle: true,
                            pointStyle: 'circle',
                            color: BRAND.inkMid,
                            // 막대(학년별)는 x축 라벨로 충분히 식별되니까 범례에서 빼고,
                            // 점선(교사당 학생수) 데이터셋만 범례에 표시
                            filter: (item) => /교사당/.test(item.text),
                        }
                    },
                    tooltip: {
                        backgroundColor: BRAND.inkDeep,
                        titleColor: '#fff',
                        titleFont: { size: 12, weight: '700' },
                        bodyColor: '#E5E7EB',
                        bodyFont: { size: 12, weight: '500' },
                        padding: 12,
                        cornerRadius: 10,
                        displayColors: true,
                        boxPadding: 6,
                        borderColor: 'rgba(255,255,255,0.08)',
                        borderWidth: 1,
                        callbacks: {
                            label: (ctx) => {
                                if (ctx.dataset.type === 'line') {
                                    return ` 교사당 학생수: ${ctx.parsed.y}명`;
                                }
                                return ` ${ctx.label}: ${ctx.parsed.y}명`;
                            },
                            // 툴팁 색상 박스를 학년별 컬러와 일치
                            labelColor: (ctx) => {
                                if (ctx.dataset.type === 'line') {
                                    return { borderColor: BRAND.indigo, backgroundColor: BRAND.indigo };
                                }
                                const c = levelColorFor(ctx.label);
                                return { borderColor: c.solid, backgroundColor: c.solid };
                            },
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false, drawBorder: false },
                        ticks: {
                            color: BRAND.inkMid,
                            font: { size: 11, weight: '600' },
                        },
                    },
                    y: {
                        type: 'linear', position: 'left',
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(14, 26, 43, 0.05)',
                            drawBorder: false,
                            tickLength: 0,
                        },
                        ticks: {
                            color: BRAND.inkSoft,
                            font: { size: 10, weight: '500' },
                            padding: 6,
                        },
                        title: {
                            display: true,
                            text: '학생수 (명)',
                            color: BRAND.inkSoft,
                            font: { size: 10, weight: '600' },
                            padding: { bottom: 6 },
                        },
                    },
                    y1: {
                        type: 'linear', position: 'right',
                        beginAtZero: true,
                        grid: { drawOnChartArea: false, drawBorder: false, tickLength: 0 },
                        ticks: {
                            color: BRAND.indigo,
                            font: { size: 10, weight: '600' },
                            padding: 6,
                        },
                        title: {
                            display: true,
                            text: '교사당',
                            color: BRAND.indigo,
                            font: { size: 10, weight: '700' },
                        },
                    },
                },
            },
        });

        drawDisabilityChart(detail);
        fillAfterschoolStats(detail);
    } catch (e) {
        console.error("차트 데이터를 가져오는 중 문제:", e);
        hideAll();
    }
}


/* =========================================================
   장애유형 도넛 차트
========================================================= */
const DISABILITY_PALETTE = [
    '#FF5A5F',  // coral
    '#FFB347',  // amber
    '#06D6A0',  // mint
    '#4F46E5',  // indigo
    '#8B5CF6',  // violet
    '#0EA5E9',  // sky
    '#F472B6',  // pink
    '#FACC15',  // yellow
    '#34D399',  // emerald
    '#A78BFA',  // light violet
    '#FB923C',  // orange
];

function drawDisabilityChart(detail) {
    const section = document.querySelector('.disability_section');
    const canvas  = document.getElementById('disability_chart');
    if (!canvas || !section) return;

    if (disabilityChart) disabilityChart.destroy();

    const rates = detail.disability_rates;
    if (!rates || Object.keys(rates).length === 0) {
        section.style.display = 'none';
        return;
    }
    section.style.display = 'block';

    const labels = Object.keys(rates);
    const data   = Object.values(rates);

    // 도넛 중앙에 "TOTAL" 텍스트 출력하는 커스텀 플러그인
    const centerTextPlugin = {
        id: 'centerText',
        afterDraw(chart) {
            const { ctx } = chart;
            const meta = chart.getDatasetMeta(0);
            if (!meta || !meta.data || !meta.data[0]) return;
            const { x, y } = meta.data[0];

            ctx.save();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // 윗 라벨
            ctx.fillStyle = BRAND.inkSoft;
            ctx.font = '600 9px Pretendard, system-ui, sans-serif';
            ctx.fillText('유형', x, y - 10);

            // 큰 숫자 (장애 유형 수)
            ctx.fillStyle = BRAND.inkDeep;
            ctx.font = '900 22px "Fraunces", Pretendard, serif';
            ctx.fillText(String(labels.length), x, y + 8);
            ctx.restore();
        }
    };

    disabilityChart = new Chart(canvas.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: DISABILITY_PALETTE.slice(0, labels.length),
                hoverBackgroundColor: DISABILITY_PALETTE.slice(0, labels.length).map(c => c),
                borderWidth: 3,
                borderColor: '#fff',
                hoverBorderWidth: 4,
                hoverOffset: 8,
                spacing: 2,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '62%',
            animation: {
                animateRotate: true,
                animateScale: true,
                duration: 1200,
                easing: 'easeOutQuart',
            },
            layout: {
                padding: { top: 4, right: 4, bottom: 4, left: 4 }
            },
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        boxWidth: 10,
                        boxHeight: 10,
                        padding: 9,
                        font: { size: 10.5, weight: '600' },
                        usePointStyle: true,
                        pointStyle: 'circle',
                        color: BRAND.inkMid,
                    }
                },
                tooltip: {
                    backgroundColor: BRAND.inkDeep,
                    titleColor: '#fff',
                    titleFont: { size: 12, weight: '700' },
                    bodyColor: '#E5E7EB',
                    bodyFont: { size: 12, weight: '500' },
                    padding: 12,
                    cornerRadius: 10,
                    displayColors: true,
                    boxPadding: 6,
                    callbacks: {
                        label: (ctx) => ` ${ctx.label}: ${ctx.parsed}%`
                    }
                }
            }
        },
        plugins: [centerTextPlugin],
    });
}


/* =========================================================
   방과후 통계 — 숫자 카운트업 애니메이션 적용
========================================================= */
function fillAfterschoolStats(detail) {
    const section = document.querySelector('.stats_section');
    const a = detail.afterschool;

    if (!a || Object.values(a).every(v => !v)) {
        section.style.display = 'none';
        return;
    }
    section.style.display = 'block';

    const animateNumber = (el, target, duration = 900) => {
        const start = performance.now();
        const from = 0;
        const to = Number(target) || 0;
        const easeOut = t => 1 - Math.pow(1 - t, 3);

        function step(now) {
            const t = Math.min(1, (now - start) / duration);
            const val = Math.round(from + (to - from) * easeOut(t));
            el.innerText = val.toLocaleString();
            if (t < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
    };

    const set = (id, val) => {
        const el = document.getElementById(id);
        const v = Number(val) || 0;
        animateNumber(el, v);
        el.style.color = v === 0 ? '#CBD5E1' : '';
    };

    set('stat_curr_pgm',     a.curriculum_pgm);
    set('stat_curr_std',     a.curriculum_student);
    set('stat_apt_pgm',      a.aptitude_pgm);
    set('stat_apt_std',      a.aptitude_student);
    set('stat_special_cls',  a.special_classes);
    set('stat_special_std',  a.special_students);
}