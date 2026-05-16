// 전역 마커 관리 배열 선언
window.currentMarkers = [];
window.kakaoMapInstance = null;
window.currentUserLocation = null;

kakao.maps.load(function() {
    const card = document.querySelector(".card");
    const closebtn = document.querySelector(".close_btn");
    const back_to_current_location = document.getElementById("back_to_current_location");

    var mapContainer = document.getElementById('map'); 
    var mapOption = { 
        center: new kakao.maps.LatLng(37.566826, 126.978656),
        level: 5
    };

    // 전역 변수에 지도 객체 할당
    window.kakaoMapInstance = new kakao.maps.Map(mapContainer, mapOption);

    // 내 위치 트래킹
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            function (position) {
                var lat = position.coords.latitude;
                var lng = position.coords.longitude;
                window.currentUserLocation = new kakao.maps.LatLng(lat, lng);
                window.kakaoMapInstance.setCenter(window.currentUserLocation);

                const userDot = new kakao.maps.CustomOverlay({
                    position: window.currentUserLocation,
                    content: '<div class="user-location-dot"></div>',
                    xAnchor: 0.5,    
                    yAnchor: 0.5,    
                    zIndex: 100     
                });
                userDot.setMap(window.kakaoMapInstance);
                
                // 위치 확인 완료 후 최초 1회 기본 마커 로드
                loadFilteredSchools();
            },
            function(error) {
                console.log("위치 정보를 가져올 수 없습니다:", error);
                // 위치 실패 시에도 기본 마커는 로드함
                loadFilteredSchools();
            }
        );
    } else {
        loadFilteredSchools();
    }

    // 카드 닫기
    closebtn.addEventListener("click", ()=> {
        card.classList.remove("active"); 
        card.classList.add("hidden");    
    });

    // 현재 위치 버튼 클릭 이벤트
    back_to_current_location.addEventListener("click", () => {
        if (window.currentUserLocation) {
            window.kakaoMapInstance.setCenter(window.currentUserLocation);
            window.kakaoMapInstance.setLevel(5);
        } else {
            alert("사용자의 현재 위치를 확인할 수 없습니다.");
        }
    });
});

// 🌟 핵심 기능: 파라미터를 조합하여 서버(MySQL)에 필터링 데이터를 요청하고 마커를 다시 그리는 핵심 함수
function getDistance(lat1, lng1, lat2, lng2) {
    const deg2rad = (deg) => deg * (Math.PI / 180);
    const R = 6371; // 지구 반지름 (km)
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lng2 - lng1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// 필터링된 학교를 불러와서 마커를 그리는 함수
// 필터링된 학교를 불러와서 마커를 그리는 함수
async function loadFilteredSchools(filterParams = {}) {
    if (!window.kakaoMapInstance) return;

    // 1. 기존 마커 일제히 지도에서 삭제
    window.currentMarkers.forEach(m => m.setMap(null));
    window.currentMarkers = [];

    const queryString = new URLSearchParams(filterParams).toString();
    
    try {
        const response = await fetch(`/api/schools?${queryString}`);
        if (!response.ok) throw new Error("학교 데이터 수집 오류");
        const schools = await response.json();

        const geocoder = new kakao.maps.services.Geocoder();

        // 🌟 2. 비동기 주소 변환을 Promise 배열로 묶어서 완벽하게 제어하기
        const geocodePromises = schools.map(school => {
            return new Promise((resolve) => {
                if (!school.address) { 
                    resolve(null); 
                    return; 
                }

                let cleanAddress = school.address.split('(')[0].trim();

                geocoder.addressSearch(cleanAddress, function(result, status) {
                    if (status === kakao.maps.services.Status.OK) {
                        let schoolLat = parseFloat(result[0].y);
                        let schoolLng = parseFloat(result[0].x);

                        // 거리 필터 적용 시
                        if (filterParams.distance && filterParams.distance !== 'all' && window.currentUserLocation) {
                            let myLat = window.currentUserLocation.getLat();
                            let myLng = window.currentUserLocation.getLng();
                            let dist = getDistance(myLat, myLng, schoolLat, schoolLng);
                            
                            if (dist > parseFloat(filterParams.distance)) {
                                resolve(null); // 거리가 멀면 마커 대상에서 제외
                                return; 
                            }
                        }
                        
                        // 유효한 학교 정보와 좌표를 반환
                        resolve({ school, lat: schoolLat, lng: schoolLng });
                    } else {
                        resolve(null); // 주소를 못 찾은 경우 제외
                    }    
                });
            });
        });

        // 🌟 3. 모든 주소 변환이 끝날 때까지 기다리기
        const results = await Promise.all(geocodePromises);
        
        // null값(제외된 학교)을 빼고 실제로 마커를 찍을 유효한 학교만 남기기
        const validResults = results.filter(item => item !== null);

        // 🌟 4. 유효한 결과만 지도에 마커로 그리기
        validResults.forEach(item => {
            var markerPosition = new kakao.maps.LatLng(item.lat, item.lng);
            var marker = new kakao.maps.Marker({
                position: markerPosition
            });
            
            marker.setMap(window.kakaoMapInstance);
            window.currentMarkers.push(marker); // 관리 배열에 추가
            
            kakao.maps.event.addListener(marker, 'click', () => {
                fillCard(item.school);
            });
        });

        // 🌟 5. 최종 필터 결과 개수를 화면에 표시하기
        const resultBox = document.getElementById("result_info");
        if (resultBox) {
            resultBox.querySelector("span").innerText = validResults.length;
            resultBox.classList.remove("hidden");

            // 알림창이 3초 뒤에 스르륵 사라지게 만들기 (계속 띄우고 싶다면 이 부분을 지우면 돼!)
            setTimeout(() => {
                resultBox.classList.add("hidden");
            }, 3000);
        }

    } catch (e) {
        console.error("필터 적용 마커 렌더링 중 에러 발생:", e);
    }
}