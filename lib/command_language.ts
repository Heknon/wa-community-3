type Language = "english" | "hebrew";

interface CommandLanguages {
    triggers: string[];

    hebrew: CommandLanguage;
    english: CommandLanguage;
}

type CommandLanguage = {
    triggers: string[];
    usage: string;
    category: string;
    description: string;
    extended_description: string;
    execution: {
        [key: string]: string;
    };
};
