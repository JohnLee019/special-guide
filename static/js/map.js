kakao.maps.load(async function() {
    const card = document.querySelector(".card");
    const closebtn = document.querySelector(".close_btn");

    var mapContainer = document.getElementById('map'); 
    var mapOption = { 
        center: new kakao.maps.LatLng(37.566826, 126.978656),
        level: 5
    };

    var map = new kakao.maps.Map(mapContainer, mapOption);

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            function(position) {
                var lat = position.coords.latitude;
                var lng = position.coords.longitude;
                var userLocation = new kakao.maps.LatLng(lat, lng);
                map.setCenter(userLocation);
            },
            function(error) {
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

        const card = document.querySelector(".card");
        const closebtn = document.querySelector(".close_btn");
        const name = document.querySelector(".school_name");

        data.forEach((school)=> {
            if(school.address) {
                geocoder.addressSearch(school.address, function(result, status) {
                if (status === kakao.maps.services.Status.OK) {
                    var markerPosition = new kakao.maps.LatLng(result[0].y, result[0].x);
                    var marker = new kakao.maps.Marker({
                        position: markerPosition
                    });
                    marker.setMap(map);
                    
                    kakao.maps.event.addListener(marker, 'click', ()=> {
                        name.innerText = school.name;
                        card.classList.remove("hidden"); 
                        card.classList.add("active");    
                    });
                    }    
                });
            };
        });

        closebtn.addEventListener("click", ()=> {
            card.classList.remove("active"); 
            card.classList.add("hidden");    
        });

    } catch (e) {
        console.log(e);
    }
});