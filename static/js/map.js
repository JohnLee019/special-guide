kakao.maps.load(async function() {
    const card = document.querySelector(".card");
    const closebtn = document.querySelector(".close_btn");
    const back_to_current_location = document.getElementById("back_to_current_location");

    var mapContainer = document.getElementById('map'); 
    var mapOption = { 
        center: new kakao.maps.LatLng(37.566826, 126.978656),
        level: 5
    };

    var map = new kakao.maps.Map(mapContainer, mapOption);

    let userLocation = null;

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            function (position) {
                var lat = position.coords.latitude;
                var lng = position.coords.longitude;
                userLocation = new kakao.maps.LatLng(lat, lng);
                map.setCenter(userLocation);

                const userDot = new kakao.maps.CustomOverlay({
                position: userLocation,
                content: '<div class="user-location-dot"></div>',
                xAnchor: 0.5,    
                yAnchor: 0.5,    
                zIndex: 100     
            });
            userDot.setMap(map);
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
                        fillCard(school);
                    });
                    }    
                });
            };
        });

        closebtn.addEventListener("click", ()=> {
            card.classList.remove("active"); 
            card.classList.add("hidden");    
        });

        back_to_current_location.addEventListener("click", () => {
            if (userLocation) {
                map.setCenter(userLocation);
                map.setLevel(5);
            } else if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        userLocation = new kakao.maps.LatLng(
                            position.coords.latitude,
                            position.coords.longitude
                        );
                        map.setCenter(userLocation);
                        map.setLevel(5);
                    },
                    (error) => {
                        alert("위치 정보를 가져올 수 없습니다.");
                        console.log(error);
                    }
                );
            } else {
                alert("이 브라우저는 위치 정보를 지원하지 않습니다.");
            }
        });

    } catch (e) {
        console.log(e);
    }
});