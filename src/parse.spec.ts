import { ArgumentConfig } from './contracts';
import {
    IMocked,
    Mock,
    setupFunction,
    replacePropertiesBeforeEach,
    addMatchers,
} from '@morgan-stanley/ts-mocking-bird';
import { parse } from './parse';

describe('parse', () => {
    let mockConsole: IMocked<typeof console>;
    let mockProcess: IMocked<typeof process>;

    interface ComplexProperties {
        requiredString: string;
        defaultedString: string;
        optionalString?: string;
        requiredArray: string[];
        optionalArray?: string[];
    }

    interface PropertiesWithHelp extends ComplexProperties {
        optionalHelpArg?: boolean;
    }

    function getConfig(): ArgumentConfig<ComplexProperties> {
        return {
            requiredString: String,
            defaultedString: { type: String, defaultValue: defaultFromOption },
            optionalString: { type: String, optional: true },
            requiredArray: { type: String, alias: 'o', multiple: true },
            optionalArray: { type: String, lazyMultiple: true, optional: true },
        };
    }

    function getHelpConfig(): ArgumentConfig<PropertiesWithHelp> {
        return {
            ...getConfig(),
            optionalHelpArg: { type: Boolean, optional: true, alias: 'h' },
        };
    }

    const requiredStringValue = 'requiredStringValue';
    const requiredString = ['--requiredString', requiredStringValue];
    const defaultedStringValue = 'defaultedStringValue';
    const defaultFromOption = 'defaultFromOption';
    const defaultedString = ['--defaultedString', defaultedStringValue];
    const optionalStringValue = 'optionalStringValue';
    const optionalString = ['--optionalString', optionalStringValue];
    const requiredArrayValue = ['requiredArray'];
    const requiredArray = ['--requiredArray', ...requiredArrayValue];
    const optionalArrayValue = ['optionalArrayValueOne', 'optionalArrayValueTwo'];
    const optionalArray = ['--optionalArray', optionalArrayValue[0], '--optionalArray', optionalArrayValue[1]];
    const optionalHelpArg = ['--optionalHelpArg'];

    replacePropertiesBeforeEach(() => {
        addMatchers();
        mockConsole = Mock.create<typeof console>().setup(setupFunction('error'));
        mockProcess = Mock.create<typeof process>().setup(setupFunction('exit'));

        return [{ package: process, mocks: mockProcess.mock }];
    });

    describe('should create the expected argument value object', () => {
        it('when all options are populated', () => {
            const result = parse(getConfig(), {
                logger: mockConsole.mock,
                argv: [...requiredString, ...defaultedString, ...optionalString, ...requiredArray, ...optionalArray],
            });

            expect(result).toEqual({
                requiredString: requiredStringValue,
                defaultedString: defaultedStringValue,
                optionalString: optionalStringValue,
                requiredArray: requiredArrayValue,
                optionalArray: optionalArrayValue,
            });
        });

        it('when optional values are ommitted', () => {
            const result = parse(getConfig(), {
                logger: mockConsole.mock,
                argv: [...requiredString, ...requiredArray],
            });

            expect(result).toEqual({
                requiredString: requiredStringValue,
                defaultedString: defaultFromOption,
                requiredArray: requiredArrayValue,
            });
        });
    });

    const expectedRequiredStringMessage = `Required parameter 'requiredString' was not passed. Please provide a value by passing '--requiredString=passedValue' in command line arguments`;
    const expectedRequiredArrayMessage = `Required parameter 'requiredArray' was not passed. Please provide a value by passing '--requiredArray=passedValue' or '-o passedValue' in command line arguments`;

    it(`should print errors and exit process when required arguments are missing`, () => {
        const result = parse(getConfig(), {
            logger: mockConsole.mock,
            argv: [...defaultedString],
        });

        expect(mockConsole.withFunction('error').withParameters(expectedRequiredStringMessage)).wasCalledOnce();
        expect(mockConsole.withFunction('error').withParameters(expectedRequiredArrayMessage)).wasCalledOnce();

        expect(mockProcess.withFunction('exit')).wasCalledOnce();

        expect(result).toBeUndefined();
    });

    it(`should print warnings, return an incomplete when arguments are missing and exitProcess is false`, () => {
        const result = parse(
            getConfig(),
            {
                logger: mockConsole.mock,
                argv: [...defaultedString],
            },
            false,
        );

        expect(mockConsole.withFunction('error').withParameters(expectedRequiredStringMessage)).wasCalledOnce();
        expect(mockConsole.withFunction('error').withParameters(expectedRequiredArrayMessage)).wasCalledOnce();

        expect(mockProcess.withFunction('exit')).wasNotCalled();

        expect(result).toEqual({
            defaultedString: defaultedStringValue,
        });
    });

    it(`should print help messages and exit when help arg is passed`, () => {
        const result = parse(getHelpConfig(), {
            logger: mockConsole.mock,
            argv: [...defaultedString, ...optionalHelpArg],
            helpArg: 'optionalHelpArg',
        });

        expect(result).toBeUndefined();
        expect(mockProcess.withFunction('exit')).wasCalledOnce();
    });

    it(`it should print help messags and return arguments when help arg passed and exitProcess is false`, () => {
        const result = parse(
            getHelpConfig(),
            {
                logger: mockConsole.mock,
                argv: [...defaultedString, ...optionalHelpArg],
                helpArg: 'optionalHelpArg',
            },
            false,
        );
        expect(result).toEqual({
            defaultedString: defaultedStringValue,
            optionalHelpArg: true,
        });
        expect(mockProcess.withFunction('exit')).wasNotCalled();
    });
});