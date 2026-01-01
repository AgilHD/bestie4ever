/**
 * Fuzzy Logic Utility for Compost Maturity
 * 
 * Replicates the logic from Python scikit-fuzzy implementation (engine.py).
 * Membership Functions: Trapezoid (trapmf) and Triangle (trimf)
 */

// --- Helper Functions ---

const trimf = (x, params) => {
    const [a, b, c] = params;
    if (x <= a || x >= c) return 0;
    if (x === b) return 1;
    if (x > a && x < b) return (x - a) / (b - a);
    if (x > b && x < c) return (c - x) / (c - b);
    return 0;
};

const trapmf = (x, params) => {
    const [a, b, c, d] = params;
    if (x <= a || x >= d) return 0;
    if (x >= b && x <= c) return 1;
    if (x > a && x < b) return (x - a) / (b - a);
    if (x > c && x < d) return (d - x) / (d - c);
    return 0;
};

// --- Membership Definitions (Matched with engine.py) ---
const MEMBERSHIP = {
    suhu: {
        dingin: (x) => trapmf(x, [0, 0, 28, 35]),
        ideal: (x) => trimf(x, [30, 45, 55]),
        panas: (x) => trapmf(x, [50, 60, 80, 80])
    },
    kelembapan: {
        kering: (x) => trapmf(x, [0, 0, 30, 40]),
        sedang: (x) => trimf(x, [40, 46, 52]),
        basah: (x) => trapmf(x, [50, 60, 100, 100])
    },
    ph: {
        asam: (x) => trapmf(x, [0, 0, 5, 6]),
        netral: (x) => trimf(x, [5.0, 7.0, 9.0]),
        basa: (x) => trapmf(x, [8, 9, 14, 14])
    },
    // Safety Variables
    ammonia: {
        tinggi: (x) => trapmf(x, [25, 30, 50, 50])
    },
    bau: {
        menyengat: (x) => trapmf(x, [6, 8, 10, 10])
    },

    // Output Membership for Defuzzification
    status_kompos: {
        buruk: { params: [0, 0, 30, 50], type: 'trapmf', centroid: 20 },
        sedang: { params: [40, 60, 80], type: 'trimf', centroid: 60 },
        baik: { params: [70, 85, 95], type: 'trimf', centroid: 85 },
        sangat_baik: { params: [90, 95, 100, 100], type: 'trapmf', centroid: 96 }
    }
};

// --- Rules (Full 27 Rules from kompos_config.json) ---
const RULES = [
    // 1-9: Asam
    { conditions: { ph: 'asam', suhu: 'dingin', kelembapan: 'kering' }, result: 'buruk' },
    { conditions: { ph: 'asam', suhu: 'dingin', kelembapan: 'sedang' }, result: 'buruk' },
    { conditions: { ph: 'asam', suhu: 'dingin', kelembapan: 'basah' }, result: 'buruk' },
    { conditions: { ph: 'asam', suhu: 'ideal', kelembapan: 'kering' }, result: 'buruk' },
    { conditions: { ph: 'asam', suhu: 'ideal', kelembapan: 'sedang' }, result: 'sedang' },
    { conditions: { ph: 'asam', suhu: 'ideal', kelembapan: 'basah' }, result: 'buruk' },
    { conditions: { ph: 'asam', suhu: 'panas', kelembapan: 'kering' }, result: 'buruk' },
    { conditions: { ph: 'asam', suhu: 'panas', kelembapan: 'sedang' }, result: 'sedang' },
    { conditions: { ph: 'asam', suhu: 'panas', kelembapan: 'basah' }, result: 'buruk' },

    // 10-18: Netral
    { conditions: { ph: 'netral', suhu: 'dingin', kelembapan: 'kering' }, result: 'sedang' },
    { conditions: { ph: 'netral', suhu: 'dingin', kelembapan: 'sedang' }, result: 'baik' },
    { conditions: { ph: 'netral', suhu: 'dingin', kelembapan: 'basah' }, result: 'sedang' },
    { conditions: { ph: 'netral', suhu: 'ideal', kelembapan: 'kering' }, result: 'baik' },
    { conditions: { ph: 'netral', suhu: 'ideal', kelembapan: 'sedang' }, result: 'sangat_baik' },
    { conditions: { ph: 'netral', suhu: 'ideal', kelembapan: 'basah' }, result: 'baik' },
    { conditions: { ph: 'netral', suhu: 'panas', kelembapan: 'kering' }, result: 'sedang' },
    { conditions: { ph: 'netral', suhu: 'panas', kelembapan: 'sedang' }, result: 'baik' },
    { conditions: { ph: 'netral', suhu: 'panas', kelembapan: 'basah' }, result: 'sedang' },

    // 19-27: Basa
    { conditions: { ph: 'basa', suhu: 'dingin', kelembapan: 'kering' }, result: 'buruk' },
    { conditions: { ph: 'basa', suhu: 'dingin', kelembapan: 'sedang' }, result: 'buruk' },
    { conditions: { ph: 'basa', suhu: 'dingin', kelembapan: 'basah' }, result: 'buruk' },
    { conditions: { ph: 'basa', suhu: 'ideal', kelembapan: 'kering' }, result: 'buruk' },
    { conditions: { ph: 'basa', suhu: 'ideal', kelembapan: 'sedang' }, result: 'sedang' },
    { conditions: { ph: 'basa', suhu: 'ideal', kelembapan: 'basah' }, result: 'buruk' },
    { conditions: { ph: 'basa', suhu: 'panas', kelembapan: 'kering' }, result: 'buruk' },
    { conditions: { ph: 'basa', suhu: 'panas', kelembapan: 'sedang' }, result: 'sedang' },
    { conditions: { ph: 'basa', suhu: 'panas', kelembapan: 'basah' }, result: 'buruk' }
];

/**
 * Main Calculation Function
 */
export const calculateFuzzy = (suhuVal, phVal, kelembapanVal, ammoniaVal = 0, bauVal = 0) => {
    // 1. Fuzzification
    const fuzz = {
        suhu: {},
        ph: {},
        kelembapan: {},
        ammonia: {},
        bau: {}
    };

    ['dingin', 'ideal', 'panas'].forEach(t => fuzz.suhu[t] = MEMBERSHIP.suhu[t](suhuVal));
    ['asam', 'netral', 'basa'].forEach(t => fuzz.ph[t] = MEMBERSHIP.ph[t](phVal));
    ['kering', 'sedang', 'basah'].forEach(t => fuzz.kelembapan[t] = MEMBERSHIP.kelembapan[t](kelembapanVal));

    // Safety Fuzzification
    fuzz.ammonia.tinggi = MEMBERSHIP.ammonia.tinggi(ammoniaVal);
    fuzz.bau.menyengat = MEMBERSHIP.bau.menyengat(bauVal);

    // 2. Inference (Rule Evaluation)
    const ruleOutputs = {
        buruk: 0,
        sedang: 0,
        baik: 0,
        sangat_baik: 0
    };

    // Safety Override (Ammonia tinggi OR Bau menyengat -> Buruk)
    const badFactor = Math.max(fuzz.ammonia.tinggi, fuzz.bau.menyengat);
    if (badFactor > 0) {
        ruleOutputs.buruk = badFactor;
    }

    // Evaluate 27 Rules
    RULES.forEach(rule => {
        const degree = Math.min(
            fuzz.ph[rule.conditions.ph],
            fuzz.suhu[rule.conditions.suhu],
            fuzz.kelembapan[rule.conditions.kelembapan]
        );

        if (degree > ruleOutputs[rule.result]) {
            ruleOutputs[rule.result] = degree;
        }
    });

    // 3. Defuzzification (Centroid)
    let numerator = 0;
    let denominator = 0;

    Object.keys(ruleOutputs).forEach(key => {
        const degree = ruleOutputs[key];
        const centroid = MEMBERSHIP.status_kompos[key].centroid;
        numerator += degree * centroid;
        denominator += degree;
    });

    let score = 0;
    if (denominator > 0) {
        score = numerator / denominator;
    }

    // 4. Labeling
    let label = "Tidak Terdefinisi";
    if (score <= 45) label = "Buruk";
    else if (score <= 75) label = "Sedang"; // backend says "Cukup / Sedang" but simple "Sedang" is fine for UI
    else if (score <= 92) label = "Baik";
    else label = "Sangat Baik";

    // Hard override regarding Smell
    // If smell is really bad (e.g. user selected "Bau Busuk"/9.0), force label to Buruk
    if (bauVal >= 9.0) {
        label = "Buruk (Bau)";
        if (score > 40) score = 40;
    }

    return { score, label };
};
