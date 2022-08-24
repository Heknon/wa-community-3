const phoneNumberRegex =
    /((?<StartCountry>(\+*)(?<CountryCode>\d{3})(\s*|)\d{2})|((0|)(?<StartNoCountry>\d{2})))(\-|\s*)(?<MiddleThree>\d{3})(\-|\s*)(?<LastFour>\d{4})/g;

export function rescueNumbers(str: string, defaultCountryCode: string = "972"): string[] {
    // iterate through all regex matches
    const regex = new RegExp(phoneNumberRegex, "g");
    let currMatch: RegExpExecArray | null;
    const numbers: string[] = [];
    while ((currMatch = regex.exec(str))) {
        if (!currMatch || !currMatch.groups) continue;

        const countryCode = currMatch.groups.CountryCode;
        const startCountry = currMatch.groups.StartCountry?.replace(/\D/g, "");
        const startNoCountry = currMatch.groups.StartNoCountry
            ? defaultCountryCode + currMatch.groups.StartNoCountry
            : undefined;
        const middleThree = currMatch.groups.MiddleThree;
        const lastFour = currMatch.groups.LastFour;
        if (!startCountry && !startNoCountry) continue;
        if (!middleThree || !lastFour) continue;

        numbers.push((startCountry ?? startNoCountry) + middleThree + lastFour);
    }

    return numbers;
}

export function removeNumbersFromString(
    str: string,
    defaultCountryCode: string | undefined = "972",
    ...numbers: (string | undefined)[]
): string {
    // iterate through all regex matches
    if (!defaultCountryCode) defaultCountryCode = "972";

    let regex = new RegExp(phoneNumberRegex, "g");
    let currMatch: RegExpExecArray | null;
    const numbersSet = new Set(numbers.filter((e) => e) as string[]);
    while ((currMatch = regex.exec(str))) {
        if (!currMatch || !currMatch.groups) continue;

        const countryCode = currMatch.groups.CountryCode;
        const startCountry = currMatch.groups.StartCountry?.replace(/\D/g, "");
        const startNoCountry = currMatch.groups.StartNoCountry
            ? defaultCountryCode + currMatch.groups.StartNoCountry
            : undefined;
        const middleThree = currMatch.groups.MiddleThree;
        const lastFour = currMatch.groups.LastFour;
        if (!startCountry && !startNoCountry) continue;
        if (!middleThree || !lastFour) continue;
        const number = (startCountry ?? startNoCountry) + middleThree + lastFour;

        if (numbersSet.has(number)) {
            str = str.replace(currMatch[0], "");
            regex = new RegExp(phoneNumberRegex, "g");
        }
    }

    return str;
}
