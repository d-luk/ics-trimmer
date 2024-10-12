import { promises as fs } from 'fs';
import { parseISO, parse as parseDate, isValid as isValidDate, format as formatDate, ParseISOOptions } from 'date-fns';
import { tz } from "@date-fns/tz";
import path from 'path';
import config from './config';

const newLine = config.newLine;

async function run(startDate: Date, endDate: Date): Promise<void> {
    const files = await readFilesByExtention(config.inputDirectory, '.ics');

    const trimmedFiles = files.map(({ fileName, content }) => {
        console.log(`Trimming ${fileName}`);

        return {
            fileName,
            content: trimIcsFile(content, startDate, endDate),
        };
    });

    await writeFiles('./output', trimmedFiles);

    if (trimmedFiles.length === 1) {
        console.log(`Wrote ${config.outputDirectory}/${trimmedFiles[0].fileName}`);
    } else {
        console.log(`Wrote ${trimmedFiles.length} files`);
    }
}

function trimIcsFile(fileContent: string, startDate: Date, endDate: Date): string {
    const lines = fileContent.split(newLine);

    let result = '';
    let buffer = '';
    let eventStart: Date | null = null;
    let eventEnd: Date | null = null;
    let isRecurring = false;

    lines.forEach(line => {
        const parsedLine = maybeParseLine(line);

        switch (parsedLine?.type) {
            case 'EVENT_START':
                result += buffer;
                buffer = line + newLine;
                break;

            case 'EVENT_END':
                buffer += line + newLine;

                const dateTimeFormat = 'yyyy-mm-dd HH:mm';

                const formattedStartDate = eventStart
                    ? formatDate(eventStart, dateTimeFormat)
                    : '<null>';

                const formattedEndDate = eventEnd
                    ? formatDate(eventEnd, dateTimeFormat)
                    : '<null>';

                const formattedDateRange = `${formattedStartDate} - ${formattedEndDate}}`;

                if (
                    !eventStart
                    || !eventEnd
                    || (eventStart >= startDate
                        && eventEnd <= endDate)
                    || (config.keepRecurringEvents && isRecurring)
                ) {
                    if (config.verboseLogs) {
                        console.log(`Keep: ${formattedDateRange}${isRecurring ? ' (recurring)' : ''}`);
                    }

                    result += buffer;
                } else if (config.verboseLogs) {
                    console.log(`Remove: ${formattedDateRange}`);
                }

                buffer = '';
                eventStart = null;
                eventEnd = null;
                isRecurring = false;
                break;

            case 'START_DATE':
                buffer += line + newLine;
                eventStart = parsedLine.date;
                break;

            case 'END_DATE':
                buffer += line + newLine;
                eventEnd = parsedLine.date;
                break;

            case 'RECURRING':
                buffer += line + newLine;
                isRecurring = true;
                break;

            default:
                buffer += line + newLine;
                break;
        }
    });

    result += buffer;
    return result;
}

async function readFilesByExtention(directory: string, extention: string): Promise<Array<{ fileName: string, content: string }>> {
    const result: Array<{ fileName: string, content: string }> = [];
    const files = await fs.readdir(directory);

    for (const file of files) {
        const filePath = path.join(directory, file);
        const fileStat = await fs.stat(filePath);

        if (fileStat.isFile() && path.extname(file) === extention) {
            const content = await fs.readFile(filePath, 'utf8');
            result.push({ fileName: file, content });
        }
    }

    return result;
}

function maybeParseLine(line: string): Line | null {
    if (line === 'BEGIN:VEVENT') {
        return { type: 'EVENT_START' };
    }

    if (line === 'END:VEVENT') {
        return { type: 'EVENT_END' };
    }

    if (line.startsWith('DTSTART:')) {
        const dateTimeString = line.substring('DTSTART:'.length);
        const date = parseIsoDate(dateTimeString);

        return { type: 'START_DATE', date };
    }

    if (line.startsWith('DTSTART;')) {
        const value = line.substring('DTSTART;'.length);
        const date = parseComplexDate(value);

        return { type: 'START_DATE', date }
    }

    if (line.startsWith('DTEND:')) {
        const dateTimeString = line.substring('DTEND:'.length);
        const date = parseIsoDate(dateTimeString);

        return { type: 'END_DATE', date };
    }

    if (line.startsWith('DTEND;')) {
        const value = line.substring('DTEND;'.length);
        const date = parseComplexDate(value);

        return { type: 'END_DATE', date }
    }

    if (line.startsWith('RRULE:')) {
        return { type: 'RECURRING' };
    }

    return null;
}

function parseComplexDate(dateString: string): Date {
    const [dateType, dateValue] = dateString.split('=');

    if (dateType === 'TZID') {
        const [timeZone, dateTimeString] = dateValue.split(':');
        const parsedDate = parseIsoDate(dateTimeString, timeZone);

        return parsedDate;
    }

    if (dateType !== 'VALUE') {
        throw new Error(`Unhandled complex date: ${dateString}`);
    }

    const [valueType, value] = dateValue.split(':');

    if (valueType !== 'DATE') {
        throw new Error(`Unhandled date with value: ${dateString}`);
    }

    const parsedDate = parseDate(value, 'yyyymmdd', new Date());

    if (!isValidDate(parsedDate)) {
        throw new Error(`Full-day date is not valid: ${dateString}`);
    }

    return parsedDate;
}

type Line =
    | { type: 'EVENT_START' }
    | { type: 'EVENT_END' }
    | { type: 'START_DATE', date: Date }
    | { type: 'END_DATE', date: Date }
    | { type: 'RECURRING' };

function parseIsoDate(dateTimeString: string, timeZone?: string): Date {
    const options = timeZone
        ? { in: tz(timeZone) } satisfies ParseISOOptions<Date>
        : undefined;

    const date = parseISO(dateTimeString, options);

    if (isValidDate(date)) {
        return date;
    }

    if (config.ignoreInvalidTimeZones) {
        const withoutTimeZone = parseISO(dateTimeString);

        if (isValidDate(withoutTimeZone)) {
            console.warn(`Time zone ${timeZone} is invalid`);
            return withoutTimeZone;
        }
    }

    throw new Error(`String is not a valid ISO date: ${dateTimeString}` + (timeZone ? ` (time zone: ${timeZone})` : ''));
}

async function writeFiles(directory: string, files: Array<{ fileName: string, content: string }>): Promise<void> {
    await fs.mkdir(directory, { recursive: true });

    const writeOperations = files.map(file => {
        const filePath = path.join(directory, file.fileName);
        return fs.writeFile(filePath, file.content);
    });

    await Promise.all(writeOperations);
}

run(config.startDate, config.endDate);
