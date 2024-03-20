import minimist from 'minimist';

/**
 * A simple utility class to gather command line arguments specified to the npm run script.
 *
 * Handles both these cases uniformly
 *      npm run foo --  --x=y # This is the only supported official way
 *      npm run foo --x=y    # This arg is eaten up by npm and passed as npm_config_foo env variable
 */
export class ArgumentParser {
  public static get<T>(optionName: string, defaultValue?: (string | number | boolean)): T {
    const argv = minimist(process.argv.slice(2));
    return argv[optionName] || process.env[`npm_config_${optionName.toLocaleLowerCase()}`] || defaultValue || null;
  }

  public static getArray(optionName: string): string[] {
    const argv = minimist(process.argv.slice(2));
    const optionValue = argv[optionName] || process.env[`npm_config_${optionName.toLocaleLowerCase()}`];
    if (Array.isArray(optionValue)) {
      return optionValue;
    } else if (optionValue) {
      return optionValue.toString().split(',');
    }
    return [];
  }
}
