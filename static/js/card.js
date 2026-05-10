const FIELD_MAP = {
        school_name:     "name",
        school_location: "address",
        school_number:   "tel",
        school_homepage: "homepage",
        school_type:     "founder",
        disable_type:    "disable_type"
    };

function fillCard(school) {
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

        card.classList.remove("hidden");
        card.classList.add("active");
    }