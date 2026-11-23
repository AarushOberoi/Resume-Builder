/* Example data (placeholder content in the main.tex layout) + blank state + section presets. */
(function () {
  'use strict';

  let n = 0;
  const uid = (p) => (p || 'x') + Date.now().toString(36) + (n++).toString(36) + Math.random().toString(36).slice(2, 6);

  const defaultSettings = () => ({
    topMode: 'reserved',     // 'reserved' (institute header space) | 'header' (name + contacts)
    reservedTopMm: 53.09,
    headerTopMm: 10,
    contTopMm: 14,
    bottomMm: 4,
    maxPages: 1,
    bulletLines: 1,
    maxBullets: 4,           // per entry; 0 = no limit
    spacing: 'template',     // 'compact' | 'template' | 'fill'
    accent: '#4169E1',
    guides: true,
  });

  const B = (text) => ({ id: uid('b'), text });
  const E = (title, date, subtitle, bullets, extra) => ({
    id: uid('e'), title, extra: extra || '', date: date || '', subtitle: subtitle || '',
    visible: true, collapsed: true, bullets: (bullets || []).map(B),
  });
  const S = (title, type, data) => Object.assign({
    id: uid('s'), title, type, visible: true, collapsed: false,
    entries: [], bullets: [], rows: [], text: '',
  }, data || {});

  function sample() {
    return {
      version: 1,
      settings: defaultSettings(),
      header: { name: 'Your Name', contacts: [{ id: uid('c'), text: 'you@example.com' }, { id: uid('c'), text: '+91 00000 00000' }, { id: uid('c'), text: 'linkedin.com/in/you' }] },
      sections: [
        S('Professional Experience', 'entries', { entries: [
          E('Data Science Intern, Northwind Analytics Pvt. Ltd.', 'May 2026 - Jul 2026',
            'Built and shipped a demand-forecasting service used by regional warehouses to plan weekly inventory and reorders', [
            'Trained **LightGBM** models on three years of sales logs, adding holiday, weather, pricing and promotion features',
            'Served forecasts through a **REST API** on **Docker**, wiring **ETL → model → dashboard** into one nightly job',
            'Cut stock-out events by **18%** across **40 stores** while lowering excess inventory and manual weekly planning effort',
          ]),
        ] }),
        S('Research Experience', 'entries', { entries: [
          E('Traffic Signal Timing Optimisation', 'Jul 2026 - Present',
            'Final Year Project: Reinforcement-learning control for multi-junction urban corridors | (Guide: Prof. A. B. Sharma)', [
            'Simulated **12 junctions** in **SUMO** with **PPO**, **DQN** and **A2C** agents; PPO reduced mean wait by **31% (9.4 s)**',
            'Validated **PPO** as most stable via **reward shaping** sweeps, beating fixed-time plans on **50+** varied traffic seeds',
            'Designed a **shared-state encoder** so a single policy generalises across corridors with different junction counts',
          ]),
          E('Robustness Benchmarking of Vision Transformers', 'Aug 2025 - Dec 2025',
            'Supervised Research Study: Image corruption vs accuracy, calibration and latency | (Guide: Prof. C. D. Mehrotra)', [
            'Evaluated **ViT-S/B/L** models on **SVHN**, **CIFAR-100** and **Tiny-ImageNet** under **blur**, **noise** and **JPEG** loss',
            'Found robustness is **scale-dependent**: larger models degraded slower on natural images than on synthetic ones',
            'Measured calibration on Tiny-ImageNet (**200 classes**): corruption raises error by **2.1–4.6%**, worst under noise',
          ]),
        ] }),
        S('Key Projects', 'entries', { entries: [
          E('Document Question-Answering Assistant', 'Spring 2026',
            'Course Project: Natural Language Processing and Information Retrieval (CS601) | (Guide: Prof. E. F. Raghavan)', [
            'Built a **4-stage RAG pipeline** answering questions over **2,000+** policy PDFs with cited passages and pages',
            'Indexed **384-dim MiniLM** embeddings in **Chroma**, passing **top-8** chunks per query to an **open-source LLM**',
            'Added a **cross-encoder re-ranker** lifting answer accuracy by **12 points**; **batching** cut latency **∼2×** overall',
          ]),
          E('Real-Time Sign Language Recognition', 'Spring 2026',
            'Self-Project: Translating hand gestures to text from a standard laptop webcam at real-time, interactive frame rates', [
            'Extracted hand landmarks with **MediaPipe** and classified **26 gestures** using a lightweight **1D-CNN** on CPU',
            'Reached **94.2%** test accuracy at **30 FPS**, with temporal smoothing that removed flicker between video frames',
          ]),
          E('Edge Deployment of Object Detection Models', 'Autumn 2026',
            'Self-Project: Running real-time object detection models on low-power single-board computers without GPU support', [
            'Pruned and quantised **YOLOv8n** to **INT8** with calibration, shrinking model size by **4×** at under **1%** mAP loss',
            'Profiled inference on a **Raspberry Pi 5**, tuning thread count and input resolution to reach **11 FPS** on device',
          ]),
          E('Smart Campus Energy Monitor — IoT Dashboard', 'Autumn 2025',
            'Course Project: Embedded Systems Design (EE612) | Sensors, low-power wireless telemetry and live web visualisation', [
            'Deployed **ESP32** nodes streaming power readings over **MQTT** to a **Grafana** dashboard for three campus hostels',
            'Designed **anomaly alerts** flagging unusual consumption, helping facilities staff cut idle-load energy waste by **9%**',
          ]),
        ] }),
        S('Positions of Responsibility', 'entries', { entries: [
          E('Events & Outreach Coordinator, Tech Club, Example Institute', 'Apr 2025 - Mar 2026',
            'Student-run technical society hosting workshops, hackathons and guest talks for **5,000+** student members every year', [
            'Organised a 36-hour hackathon with **600+** participants; secured **8** sponsors covering the entire event budget',
            'Led a **15-member** team running weekly workshops on **Git**, **Python** and **web development** for all first-years',
            'Grew newsletter readership by **120%** to **9K+** subscribers via consistent weekly content and social media outreach',
          ]),
        ] }),
        S('Technical Skills', 'table', { rows: [
          { id: uid('r'), label: 'Languages', value: 'Python, C++, C, Java, SQL, JavaScript, TypeScript, Bash, HTML/CSS, R, Go, Rust, LaTeX' },
          { id: uid('r'), label: 'AI/ML', value: 'PyTorch, TensorFlow, Scikit-Learn, LightGBM, NumPy, Pandas, OpenCV, Hugging Face' },
          { id: uid('r'), label: 'Software', value: 'Docker, Git, Linux, MATLAB, Excel, React, Node.js, PostgreSQL, Grafana, AWS, Figma' },
        ] }),
        S('Awards, Recognition & Extracurricular', 'bullets', { bullets: [
          'Ranked in the top **2%** of **15,000+** teams at a national coding contest and qualified for the on-site grand finale',
          'Received the **Dean’s Merit Scholarship** for **3 years** for academic performance in the top **5%** of the whole class',
          'Won **1st place** at an inter-college robotics competition among **60** teams for an autonomous line-follower robot',
          'Volunteered with a **10-member team** teaching basic computer skills to **150+** students at local public schools',
          'Serving as one of **20 TAs** for an introductory programming course; handling **labs**, **grading** and **doubt sessions**',
        ].map(B) }),
      ],
    };
  }

  function blank() {
    return {
      version: 1,
      settings: Object.assign(defaultSettings(), { topMode: 'header' }),
      header: { name: '', contacts: [] },
      sections: [
        S('Education', 'entries', { entries: [E('', '', '', [''])] }),
        S('Experience', 'entries', { entries: [E('', '', '', [''])] }),
        S('Technical Skills', 'table', { rows: [{ id: uid('r'), label: '', value: '' }] }),
      ].map(s => { s.entries.forEach(e => (e.collapsed = false)); return s; }),
    };
  }

  /* Presets for "Add section" — name + layout. Users can rename anything. */
  const PRESETS = [
    { title: 'Education', type: 'entries' },
    { title: 'Professional Experience', type: 'entries' },
    { title: 'Internships', type: 'entries' },
    { title: 'Research Experience', type: 'entries' },
    { title: 'Key Projects', type: 'entries' },
    { title: 'Positions of Responsibility', type: 'entries' },
    { title: 'Publications', type: 'bullets' },
    { title: 'Certifications', type: 'bullets' },
    { title: 'Achievements', type: 'bullets' },
    { title: 'Extracurricular Activities', type: 'bullets' },
    { title: 'Technical Skills', type: 'table' },
    { title: 'Summary', type: 'text' },
  ];

  const TYPES = {
    entries: { label: 'Entries', hint: 'Title, date, sub-line and bullet points' },
    bullets: { label: 'Bullet list', hint: 'A plain list of bullet points' },
    table: { label: 'Two-column table', hint: 'Label | value rows (e.g. skills)' },
    text: { label: 'Paragraph', hint: 'A short block of text' },
  };

  window.Sample = { uid, sample, blank, defaultSettings, PRESETS, TYPES, newEntry: () => Object.assign(E('', '', '', ['']), { collapsed: false }), newBullet: () => B(''), newSection: S };
})();
