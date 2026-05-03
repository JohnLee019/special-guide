kakao.maps.load(async function() {
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

    const respond = await fetch('/api/schools');
    try {
        if (!respond) {
            return ("fetch 오류");
        }
        const data = await respond.json();
        const geocoder = new kakao.maps.services.Geocoder();

        data.forEach((school)=> {
            if(school.address) {
                geocoder.addressSearch(school.address, function(result, status) {
                if (status === kakao.maps.services.Status.OK) {
                    var markerPosition = new kakao.maps.LatLng(result[0].y, result[0].x);
                    var marker = new kakao.maps.Marker({
                        position: markerPosition
                    });
                        marker.setMap(map);
                    }    
                });
            };
        });

    } catch (e) {
        console.log(e);
    }
});