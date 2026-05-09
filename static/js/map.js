kakao.maps.load(async function() {
    const card = document.querySelector(".card");
    const closebtn = document.querySelector(".close_btn");
    const FIELD_MAP = {
        school_name:     "name",
        school_location: "address",
        school_number:   "tel",
        school_homepage: "homepage",
        school_type:     "founder",
        disable_type:    "disable_type"
    };

    function fillCard(school) {
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

        card.classList.remove("hidden");
        card.classList.add("active");
    }

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

    } catch (e) {
        console.log(e);
    }
});