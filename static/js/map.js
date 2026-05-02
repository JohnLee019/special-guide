kakao.maps.load(function() {
    var mapContainer = document.getElementById('map'); 
    var mapOption = { 
        center: new kakao.maps.LatLng(37.566826, 126.978656),
        level: 5
    };

    var map = new kakao.maps.Map(mapContainer, mapOption);

    // 사용자 위치 가져오기
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            function(position) {
                // 성공 시 — 사용자 위치로 지도 이동
                var lat = position.coords.latitude;
                var lng = position.coords.longitude;
                var userLocation = new kakao.maps.LatLng(lat, lng);
                map.setCenter(userLocation);
            },
            function(error) {
                // 실패 시 — 기본값(서울 시청) 유지
                console.log("위치 정보를 가져올 수 없습니다:", error);
            }
        );
    }
});