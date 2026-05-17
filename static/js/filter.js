const AI_RECOMMENDED_SCHOOLS = [
    {
        name: '서울정애학교',
        address: '서울특별시 강남구 봉은사로81길 16',
        founder: '공립',
        disable_type: '정신지체',
        tel: '02-987-1234',
        homepage: 'www.seouljungae.sc.kr',
        photo: 'https://via.placeholder.com/400x200/FF5A5F/FFFFFF?text=%EC%84%9C%EC%9A%B8%EC%A0%95%EC%95%A0%ED%95%99%EA%B5%90',
        reason: '서울 강북권에 위치한 공립 특수학교로, 지적장애·자폐성장애 학생을 위한 체계적인 교육과정과 다양한 직업 체험 프로그램을 운영하고 있어 사회 적응력 향상에 강점이 있습니다.'
    },
    {
        name: '밀알학교',
        address: '서울특별시 강남구 일원로 90',
        founder: '사립',
        disable_type: '자폐성장애',
        tel: '02-3411-1234',
        homepage: 'www.miral.sc.kr',
        photo: 'https://via.placeholder.com/400x200/4F46E5/FFFFFF?text=%EB%B0%80%EC%95%8C%ED%95%99%EA%B5%90',
        reason: '강남구 일원동에 자리한 사립 특수학교로, 통합교육 환경과 예술·체육 중심의 방과후 활동이 활발하여 학생 개개인의 강점을 키울 수 있는 환경이 우수합니다.'
    },
    {
        name: '한국육영학교',
        address: '서울특별시 송파구 충민로6길 15',
        founder: '사립',
        disable_type: '정신지체',
        tel: '02-2606-1234',
        homepage: 'www.koreayookyoung.sc.kr',
        photo: 'https://via.placeholder.com/400x200/06D6A0/FFFFFF?text=%ED%95%9C%EA%B5%AD%EC%9C%A1%EC%98%81%ED%95%99%EA%B5%90',
        reason: '오랜 역사와 풍부한 임상 경험을 가진 교사진이 안정적인 교사당 학생 비율 속에서 학생 한 명 한 명을 세심하게 돌보는 학교로, 학습 만족도가 매우 높습니다.'
    }
];

document.addEventListener("DOMContentLoaded", () => {
    const filterModal     = document.querySelector(".filter");
    const openFilterBtn   = document.getElementById("open_filter_btn");
    const closeFilterBtn  = document.querySelector(".filter_header .close_btn");
    const applyFilterBtn  = document.getElementById("apply_filter");
    const resetFilterBtn  = document.getElementById("reset_filter");
    const aiChatModal     = document.getElementById("ai_chat_modal");
    const openAiChatBtn   = document.getElementById("open_ai_chat_btn");
    const closeChatBtn    = document.getElementById("close_chat_btn");
    const chatInput       = document.getElementById("chat_input");
    const sendChatBtn     = document.getElementById("send_chat_btn");
    const chatBody        = document.getElementById("chat_body");

    /* ---------- 필터 모달 ---------- */
    if (openFilterBtn) {
        openFilterBtn.addEventListener("click", () => filterModal.classList.add("active"));
    }
    if (closeFilterBtn) {
        closeFilterBtn.addEventListener("click", () => filterModal.classList.remove("active"));
    }
    if (filterModal) {
        filterModal.addEventListener("click", (e) => {
            if (e.target === filterModal) filterModal.classList.remove("active");
        });
    }

    if (applyFilterBtn) {
        applyFilterBtn.addEventListener("click", () => {
            const whatSchool     = document.getElementById("what_school").value;
            const disabilityType = document.getElementById("disability_type").value;
            const distance       = document.getElementById("distance").value;

            const checkedGrades = Array.from(document.querySelectorAll('input[name="grade"]:checked'))
                                       .map(cb => cb.value).join(',');

            const sido = document.getElementById("sido").value;
            const checkedAfters = Array.from(document.querySelectorAll('input[name="afterschool"]:checked'))
                                       .map(cb => cb.value).join(',');

            const params = {
                what_school: whatSchool,
                disability_type: disabilityType,
                distance: distance,
                grades: checkedGrades,
                sido: sido,
                afterschools: checkedAfters
            };

            loadFilteredSchools(params);
            filterModal.classList.remove("active");
        });
    }

    if (resetFilterBtn) {
        resetFilterBtn.addEventListener("click", () => {
            document.getElementById("what_school").value = "all";
            document.getElementById("disability_type").value = "all";
            document.getElementById("distance").value = "all";
            document.getElementById("sido").value = "all";

            const checkboxes = document.querySelectorAll('input[name="grade"], input[name="afterschool"]');
            checkboxes.forEach(cb => cb.checked = false);

            loadFilteredSchools({});
            filterModal.classList.remove("active");
        });
    }

    /* ---------- AI 채팅 모달 열기/닫기 ---------- */
    if (openAiChatBtn && aiChatModal) {
        openAiChatBtn.addEventListener("click", () => {
            aiChatModal.classList.remove("hidden");
            setTimeout(() => chatInput && chatInput.focus(), 350);
        });
    }
    if (closeChatBtn && aiChatModal) {
        closeChatBtn.addEventListener("click", () => aiChatModal.classList.add("hidden"));
    }

    /* =========================================================
       AI 채팅 — 시연용 (입력 내용 무시, 항상 같은 응답)
       1) 사용자 메시지 표시
       2) "찾고 있습니다..." 로딩 버블 5초 노출
       3) 추천 학교 3곳 카드 형태로 표시
       4) 카드 클릭 → 지도 이동 + 학교 카드 오픈
    ========================================================= */
    let isWaitingForAI = false;

    const appendUserBubble = (text) => {
        const b = document.createElement('div');
        b.className = 'chat-bubble user';
        b.textContent = text;
        chatBody.appendChild(b);
        scrollChatToBottom();
    };

    const appendLoadingBubble = () => {
        const b = document.createElement('div');
        b.className = 'chat-bubble ai ai-loading';
        b.innerHTML = `
            <span class="loading-text">사용자의 요구에 맞는 학교를 찾고 있습니다</span>
            <span class="typing-dots"><span></span><span></span><span></span></span>
        `;
        chatBody.appendChild(b);
        scrollChatToBottom();
        return b;
    };

    const appendRecommendationBubble = () => {
        const b = document.createElement('div');
        b.className = 'chat-bubble ai ai-recommendation';
        const cards = AI_RECOMMENDED_SCHOOLS.map((s, i) => `
            <div class="ai-school-card" data-idx="${i}" role="button" tabindex="0">
                <div class="ai-school-card_top">
                    <span class="ai-school-card_badge">추천 ${i + 1}</span>
                    <span class="ai-school-card_name">${s.name}</span>
                    <span class="ai-school-card_arrow" aria-hidden="true">→</span>
                </div>
                <div class="ai-school-card_reason">${s.reason}</div>
            </div>
        `).join('');
        b.innerHTML = `
            <div class="ai-recommendation_intro">
                아이에게 잘 맞을 만한 <b>학교 3곳</b>을 찾았어요! ✨<br>
                학교 카드를 누르면 지도에서 위치를 확인할 수 있어요.
            </div>
            ${cards}
        `;
        chatBody.appendChild(b);
        scrollChatToBottom();
    };

    const scrollChatToBottom = () => {
        // 부드러운 스크롤
        chatBody.scrollTo({ top: chatBody.scrollHeight, behavior: 'smooth' });
    };

    const handleSend = () => {
        if (isWaitingForAI) return;
        const text = (chatInput.value || '').trim();
        if (!text) return;

        isWaitingForAI = true;
        chatInput.value = '';
        chatInput.disabled = true;
        sendChatBtn.disabled = true;
        sendChatBtn.textContent = '검색 중';

        appendUserBubble(text);

        // 짧은 딜레이 후 로딩 버블 띄우기 (자연스러운 호흡)
        setTimeout(() => {
            const loadingBubble = appendLoadingBubble();

            // 🌟 5초 후 추천 표시
            setTimeout(() => {
                loadingBubble.remove();
                appendRecommendationBubble();

                isWaitingForAI = false;
                chatInput.disabled = false;
                sendChatBtn.disabled = false;
                sendChatBtn.textContent = '전송';
                chatInput.focus();
            }, 5000);
        }, 350);
    };

    if (sendChatBtn) sendChatBtn.addEventListener('click', handleSend);
    if (chatInput) {
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
            }
        });
    }

    /* AI 추천 학교 카드 클릭 — 이벤트 위임 */
    if (chatBody) {
        chatBody.addEventListener('click', (e) => {
            const card = e.target.closest('.ai-school-card');
            if (!card) return;
            const idx = parseInt(card.dataset.idx, 10);
            const school = AI_RECOMMENDED_SCHOOLS[idx];
            if (school) navigateToRecommendedSchool(school);
        });
        // 키보드 접근성 (Enter/Space)
        chatBody.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            const card = e.target.closest('.ai-school-card');
            if (!card) return;
            e.preventDefault();
            const idx = parseInt(card.dataset.idx, 10);
            const school = AI_RECOMMENDED_SCHOOLS[idx];
            if (school) navigateToRecommendedSchool(school);
        });
    }
});


/* =========================================================
   추천 학교 → 지도 이동 + 카드 표시
========================================================= */
function navigateToRecommendedSchool(school) {
    const aiChatModal = document.getElementById('ai_chat_modal');
    if (aiChatModal) aiChatModal.classList.add('hidden');

    // 카카오맵 사용 가능 여부에 따라 분기
    if (typeof kakao !== 'undefined' && window.kakaoMapInstance && kakao.maps?.services?.Geocoder) {
        const geocoder = new kakao.maps.services.Geocoder();
        geocoder.addressSearch(school.address, (result, status) => {
            if (status === kakao.maps.services.Status.OK) {
                const coords = new kakao.maps.LatLng(result[0].y, result[0].x);
                // 부드럽게 이동 + 적당한 줌
                window.kakaoMapInstance.panTo(coords);
                setTimeout(() => {
                    if (window.kakaoMapInstance.getLevel() > 5) {
                        window.kakaoMapInstance.setLevel(5);
                    }
                }, 450);
            }
            // 카드 채우기는 위치 변환 결과와 무관하게 진행
            if (typeof fillCard === 'function') fillCard(school);
        });
    } else {
        // 카카오맵이 없는 환경 — 그냥 카드만 띄움
        if (typeof fillCard === 'function') fillCard(school);
    }
}