document.addEventListener("DOMContentLoaded", () => {
    const filterModal = document.querySelector(".filter");
    const openFilterBtn = document.getElementById("open_filter_btn");
    const closeFilterBtn = document.querySelector(".filter_header .close_btn");
    const applyFilterBtn = document.getElementById("apply_filter");
    const resetFilterBtn = document.getElementById("reset_filter");

    // 1. 필터 열기
    if (openFilterBtn) {
        openFilterBtn.addEventListener("click", () => {
            filterModal.classList.add("active");
        });
    }

    // 2. 필터 닫기 (X 버튼)
    if (closeFilterBtn) {
        closeFilterBtn.addEventListener("click", () => {
            filterModal.classList.remove("active");
        });
    }

    // 3. 필터 어두운 배경 선택 시 닫기 기본 처리
    if (filterModal) {
        filterModal.addEventListener("click", (e) => {
            if (e.target === filterModal) {
                filterModal.classList.remove("active");
            }
        });
    }

    // 4. 🌟 핵심: 조건 적용하기 버튼 클릭 시 이벤트
    if (applyFilterBtn) {
        applyFilterBtn.addEventListener("click", () => {
            const whatSchool = document.getElementById("what_school").value;
            const disabilityType = document.getElementById("disability_type").value;
            const distance = document.getElementById("distance").value;

            const checkedGrades = Array.from(document.querySelectorAll('input[name="grade"]:checked'))
                                       .map(cb => cb.value)
                                       .join(',');

            // 🌟 새로 추가: 지역명 및 선택한 방과후 프로그램 배열 추출
            const sido = document.getElementById("sido").value;
            const checkedAfters = Array.from(document.querySelectorAll('input[name="afterschool"]:checked'))
                                       .map(cb => cb.value)
                                       .join(',');

            const params = {
                what_school: whatSchool,
                disability_type: disabilityType,
                distance: distance,
                grades: checkedGrades,
                // 🌟 파라미터 전송 항목에 추가
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
            
            // 🌟 리셋 대상에 추가
            document.getElementById("sido").value = "all";

            const checkboxes = document.querySelectorAll('input[name="grade"], input[name="afterschool"]');
            checkboxes.forEach(cb => cb.checked = false);

            loadFilteredSchools({});
            filterModal.classList.remove("active");
        });
    }

    // 5. 초기화 버튼 클릭 시
    if (resetFilterBtn) {
        resetFilterBtn.addEventListener("click", () => {
            document.getElementById("what_school").value = "all";
            document.getElementById("disability_type").value = "all";
            document.getElementById("distance").value = "all";
            
            const checkboxes = document.querySelectorAll('input[name="grade"]');
            checkboxes.forEach(cb => cb.checked = false);

            // 필터 없는 원본 전체 상태로 리셋 로드
            loadFilteredSchools({});
            filterModal.classList.remove("active");
        });
    }
});