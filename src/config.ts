import { startOfWeek, endOfWeek, subWeeks, } from 'date-fns';

const now = new Date();

export default {
    startDate: startOfWeek(subWeeks(now, 1)),
    endDate: endOfWeek(now),
    newLine: '\r\n',
    ignoreInvalidTimeZones: true,
    keepRecurringEvents: true,
    inputDirectory: './input',
    outputDirectory: './output',
    verboseLogs: false,
};
