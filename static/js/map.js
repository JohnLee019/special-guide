var mapContainer = document.getElementById('map'), // 지도를 표시할 div 
            mapOption = { 
                center: new kakao.maps.LatLng(37.566826, 126.978656), // 지도의 중심좌표 (위도, 경도)
                level: 3 // 지도의 확대 레벨 (숫자가 작을수록 확대됨)
            };

        // 지도를 표시할 div와  지도 옵션으로  지도를 생성합니다
        var map = new kakao.maps.Map(mapContainer, mapOption);

