/**
 * Fuzzy Logic Utility for Compost Maturity
 * 
 * Replicates the logic from Python scikit-fuzzy implementation.
 * Membership Functions: Trapezoid (trapmf) and Triangle (trimf)
 */

// --- Helper Functions ---

// Triangular Membership Function
const trimf = (x, params) => {
    const [a, b, c] = params;
    if (x <= a || x >= c) return 0;
    if (x === b) return 1;
    if (x > a && x < b) return (x - a) / (b - a);
    if (x > b && x < c) return (c - x) / (c - b);
    return 0;
};

// Trapezoidal Membership Function
const trapmf = (x, params) => {
    const [a, b, c, d] = params;
    if (x <= a || x >= d) return 0;
    if (x >= b && x <= c) return 1;
    if (x > a && x < b) return (x - a) / (b - a);
    if (x > c && x < d) return (d - x) / (d - c);
    return 0;
};

// --- Membership Definitions ---

const MEMBERSHIP = {
    kelembapan: {
        kering: (x) => trapmf(x, [0, 0, 30, 40]),
        sedang: (x) => trimf(x, [40, 45, 50]),
        basah: (x) => trapmf(x, [50, 60, 80, 100]) // Extended to 100
    },
    suhu: {
        dingin: (x) => trapmf(x, [0, 0, 20, 30]),
        ideal: (x) => trimf(x, [30, 40, 50]),
        panas: (x) => trapmf(x, [50, 60, 100, 100]) // Extended to 100
    },
    ph: {
        asam: (x) => trapmf(x, [0, 0, 5, 6]), // Extended to 0
        netral: (x) => trimf(x, [6, 6.75, 7.5]),
        basa: (x) => trapmf(x, [7, 8, 14, 14]) // Extended to 14
    },
    status_kompos: {
        buruk: { params: [0, 0, 30, 50], type: 'trapmf', centroid: 20 },   // approx centroid
        sedang: { params: [40, 60, 80], type: 'trimf', centroid: 60 },
        baik: { params: [70, 85, 95], type: 'trimf', centroid: 85 },
        sangat_baik: { params: [90, 95, 100, 100], type: 'trapmf', centroid: 96 }
    }
};

// --- Rule Evaluation ---

// Rules from config_fis.json / app.py
// Format: [ph, suhu, kelembapan] -> status_kompos
const RULES = [
    // Buruk
    { conditions: { ph: 'asam', suhu: 'dingin', kelembapan: 'basah' }, result: 'buruk' },
    { conditions: { ph: 'asam', suhu: 'panas', kelembapan: 'kering' }, result: 'buruk' },
    { conditions: { ph: 'basa', suhu: 'dingin', kelembapan: 'basah' }, result: 'buruk' },
    { conditions: { ph: 'basa', suhu: 'panas', kelembapan: 'kering' }, result: 'buruk' },
    { conditions: { ph: 'asam', suhu: 'ideal', kelembapan: 'basah' }, result: 'buruk' },
    { conditions: { ph: 'basa', suhu: 'ideal', kelembapan: 'basah' }, result: 'buruk' },

    // Sedang
    { conditions: { ph: 'asam', suhu: 'ideal', kelembapan: 'sedang' }, result: 'sedang' },
    { conditions: { ph: 'basa', suhu: 'ideal', kelembapan: 'sedang' }, result: 'sedang' },
    { conditions: { ph: 'netral', suhu: 'dingin', kelembapan: 'sedang' }, result: 'sedang' },
    { conditions: { ph: 'netral', suhu: 'ideal', kelembapan: 'basah' }, result: 'sedang' },
    { conditions: { ph: 'netral', suhu: 'panas', kelembapan: 'kering' }, result: 'sedang' },
    { conditions: { ph: 'asam', suhu: 'panas', kelembapan: 'sedang' }, result: 'sedang' },

    // Baik
    { conditions: { ph: 'netral', suhu: 'ideal', kelembapan: 'kering' }, result: 'baik' },
    { conditions: { ph: 'netral', suhu: 'panas', kelembapan: 'sedang' }, result: 'baik' },
    { conditions: { ph: 'netral', suhu: 'dingin', kelembapan: 'sedang' }, result: 'baik' },

    // Sangat Baik
    { conditions: { ph: 'netral', suhu: 'ideal', kelembapan: 'sedang' }, result: 'sangat_baik' },
];

/**
 * Main Calculation Function
 * Uses Mamdani-style inference with Center of Gravity (Centroid) defuzzification (simplified)
 */
export const calculateFuzzy = (suhuVal, phVal, kelembapanVal) => {
    // 1. Fuzzification
    const fuzz = {
        suhu: {},
        ph: {},
        kelembapan: {}
    };

    // Calculate degree of membership for each input
    ['dingin', 'ideal', 'panas'].forEach(term => fuzz.suhu[term] = MEMBERSHIP.suhu[term](suhuVal));
    ['asam', 'netral', 'basa'].forEach(term => fuzz.ph[term] = MEMBERSHIP.ph[term](phVal));
    ['kering', 'sedang', 'basah'].forEach(term => fuzz.kelembapan[term] = MEMBERSHIP.kelembapan[term](kelembapanVal));

    // 2. Inference (Evaluate Rules)
    const ruleOutputs = {
        buruk: 0,
        sedang: 0,
        baik: 0,
        sangat_baik: 0
    };

    RULES.forEach(rule => {
        // AND operator = Min
        const degree = Math.min(
            fuzz.ph[rule.conditions.ph],
            fuzz.suhu[rule.conditions.suhu],
            fuzz.kelembapan[rule.conditions.kelembapan]
        );

        // Max aggregation (OR) for same consequence
        if (degree > ruleOutputs[rule.result]) {
            ruleOutputs[rule.result] = degree;
        }
    });

    // 3. Defuzzification (Simplified Centroid)
    // Formula: Sum(Degree * Centroid) / Sum(Degree)

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
    } else {
        // Fallback or Default if no rules fire
        score = 0;
    }

    // 4. Labeling based on Score
    let label = "Tidak Terdefinisi";
    if (score <= 45) label = "Buruk";
    else if (score <= 75) label = "Sedang";
    else if (score <= 92) label = "Baik";
    else label = "Sangat Baik";

    return {
        score,
        label,
        details: ruleOutputs // Optional: for debugging
    };
};
