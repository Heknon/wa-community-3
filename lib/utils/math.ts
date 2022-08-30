const asc = (arr: number[]) => arr.sort((a, b) => a - b);

const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);

const mean = (arr: number[]) => sum(arr) / arr.length;

// sample standard deviation
const std = (arr: number[]) => {
    const mu = mean(arr);
    const diffArr = arr.map((a) => (a - mu) ** 2);
    return Math.sqrt(sum(diffArr) / (arr.length - 1));
};

const quantile = (arr: number[], q: number, sortedArr?: number[]) => {
    const sorted = sortedArr ?? asc(arr);
    const pos = (sorted.length - 1) * q;
    const base = Math.floor(pos);
    const rest = pos - base;
    if (sorted[base + 1] !== undefined) {
        return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
    } else {
        return sorted[base];
    }
};

const quantiles = (arr: number[], qs: number[]) => {
    const sorted = asc(arr);
    return qs.map((q) => quantile(arr, q, sorted));
}