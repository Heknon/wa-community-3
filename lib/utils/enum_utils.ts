export function fullEnumSearch(e: object, query: string) {
    let properties = Object.getOwnPropertyNames(e).map(e => typeof e === typeof "" ? e.toLowerCase() : e);
    properties = properties.slice(properties.length / 2);

    const index = properties.indexOf(query);
    const routineType = index >= 0 ? index : NaN;
    const number = Number.parseInt(query) >= 0 ? Number.parseInt(query) : routineType;
    return number >= 0 && Number.isInteger(number) ? number : undefined;
}