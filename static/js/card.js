const FIELD_MAP = {
    school_name:     "name",
    school_location: "address",
    school_number:   "tel",
    school_homepage: "homepage",
    school_type:     "founder",
    disable_type:    "disable_type"
};

let schoolChart = null; // 차트 인스턴스를 저장하여 중복 생성을 막는 용도

async function fillCard(school) {
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

    // 상세 데이터 (학생수) 불러와서 차트 그리기 실행
    await fetchAndDrawChart(school);
}

async function fetchAndDrawChart(school) {
    const canvas       = document.getElementById('school_chart');
    const chartSection = document.querySelector('.chart_section');
    const totalEl      = document.getElementById('total_students');

    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (schoolChart) schoolChart.destroy();

    const hideAll = () => {
        chartSection.style.display = 'none';
        totalEl.style.display = 'none';
    };

    // 🌟 변경: 이제 sido_code, sgg_code 확인을 안 하고 이름(name)만 있으면 통과!
    if (!school.name) {
        hideAll();
        return;
    }

    try {
        // 🌟 변경: 파라미터에서 sido_code, sgg_code를 빼고 이름만 서버로 보냅니다.
        const url = `/api/school_detail?school_name=${encodeURIComponent(school.name)}`;
        const res = await fetch(url);
        
        if (!res.ok) { hideAll(); return; }

        const detail = await res.json();
        
        if (detail.error) { hideAll(); return; }

        const levels = detail.levels;
        if (!levels || Object.keys(levels).length === 0) { hideAll(); return; }

        // 표시 ON
        chartSection.style.display = 'block';
        totalEl.style.display = 'block';

        // 총 학생수 / 교사수 — 차트 밖 텍스트
        const total    = detail.total_students;
        const teachers = detail.teachers;
        totalEl.innerText = `총 학생수 ${total}명 · 교사 ${teachers}명`;

        // 학년 순서 고정
        const LEVEL_ORDER = ["유치부", "초등부", "중등부", "고등부", "전공과"];
        const labels     = LEVEL_ORDER.filter(k => levels[k] !== undefined);
        const dataValues = labels.map(k => levels[k]);

        // 데이터셋 — 막대(학년별 학생수) + 선(교사당 학생수)
        const spt = detail.students_per_teacher;
        const datasets = [
            {
                type: 'bar',
                label: '학년별 학생수 (명)',
                data: dataValues,
                backgroundColor: 'rgba(54, 162, 235, 0.5)',
                borderColor:     'rgba(54, 162, 235, 1)',
                borderWidth: 1,
                yAxisID: 'y',
                order: 2,
            },
        ];
        if (spt && spt > 0) {
            datasets.push({
                type: 'line',
                label: `교사당 학생수 (${spt}명)`,
                data: labels.map(() => spt),   // 모든 x 위치에 같은 값 → 수평선
                borderColor: 'rgba(255, 99, 132, 1)',
                borderWidth: 2,
                borderDash: [6, 4],
                pointRadius: 0,
                fill: false,
                yAxisID: 'y1',
                order: 1,
            });
        }

        schoolChart = new Chart(ctx, {
            data: { labels, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        type: 'linear', position: 'left',
                        beginAtZero: true,
                        title: { display: true, text: '학생수 (명)' },
                    },
                    y1: {
                        type: 'linear', position: 'right',
                        beginAtZero: true,
                        grid: { drawOnChartArea: false },  // 오른쪽 축 grid 숨김 (가독성)
                        title: { display: true, text: '교사당 학생수' },
                    },
                },
            },
        });
        drawDisabilityChart(detail);
        fillAfterschoolStats(detail);
    } catch (e) {
        console.error("차트 데이터를 가져오는 중 문제:", e);
        hideAll();
    }
}


let disabilityChart = null;

const DISABILITY_PALETTE = [
    '#5B8DEF', '#7AC74F', '#FFB347', '#E5707E', '#9B7EDE',
    '#4FC3C7', '#FFD66B', '#A0826D', '#F08080', '#85C1E9', '#BDC3C7'
];

function drawDisabilityChart(detail) {
    const section = document.querySelector('.disability_section');
    const canvas  = document.getElementById('disability_chart');
    if (!canvas || !section) return;

    if (disabilityChart) disabilityChart.destroy();

    const rates = detail.disability_rates;
    if (!rates || Object.keys(rates).length === 0) {
        section.style.display = 'none';
        return;
    }
    section.style.display = 'block';

    const labels = Object.keys(rates);
    const data   = Object.values(rates);

    disabilityChart = new Chart(canvas.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: DISABILITY_PALETTE.slice(0, labels.length),
                borderWidth: 1,
                borderColor: '#fff',
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: { boxWidth: 12, padding: 8, font: { size: 11 } }
                },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `${ctx.label}: ${ctx.parsed}%`
                    }
                }
            }
        }
    });
}

function fillAfterschoolStats(detail) {
    const section = document.querySelector('.stats_section');
    const a = detail.afterschool;
    
    if (!a || Object.values(a).every(v => !v)) {
        section.style.display = 'none';
        return;
    }
    section.style.display = 'block';

    const set = (id, val) => {
        const el = document.getElementById(id);
        el.innerText = (val || 0).toLocaleString();
        el.style.color = (val || 0) === 0 ? '#bbb' : '';  
    };
    set('stat_curr_pgm',     a.curriculum_pgm);
    set('stat_curr_std',     a.curriculum_student);
    set('stat_apt_pgm',      a.aptitude_pgm);
    set('stat_apt_std',      a.aptitude_student);
    set('stat_special_cls',  a.special_classes);
    set('stat_special_std',  a.special_students);
}