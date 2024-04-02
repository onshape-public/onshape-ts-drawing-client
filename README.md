#### Description
Sample Onshape Drawing API client in typescript.

This sample has a long set of possible tasks that can be run, all of the form

	$ npm run xxx

where xxx is a task name, often followed by arguments that can vary task by task.

#### Installation

1. Install git, nodejs and npm
1. Clone this Github repo locally and cd into the folder
1. Create a credentials.json file in the top level folder that looks like:

```
{
   "cad": {
       "url": "https://cad.onshape.com",
       "accessKey": "your Onshape API access key",
       "secretKey": "your Onshape API secret key"
   }
}
```

You must obtain an API key from Onshape.  See

https://onshape-public.github.io/docs/auth/apikeys/

If you are working with a company, you can specify an extra field in the credentials.json
file:

```
       "companyId": "your company id"
```

#### Building

Run these commands in the top folder:

    $ npm install

    $ npm run build
    
You will need to run "npm run build" after any code changes you make to the sample unless you setup the tsc: watch setting in Visual Studio Code (press (⇧⌘B) and then choose tsc:watch - tsconfig.json from the dropdown to select a task), which will cause it to automatically build on code changes.
    
#### Running Sample Tasks

After building, you can run any of these sample tasks from the terminal command line:

```
npm run create-note -documenturi=<document uri> --stack cad

npm run create-callout -documenturi=<document uri> --stack cad

npm run create-centerline -documenturi=<document uri> --stack cad

npm run create-radial-dimension -documenturi=<document uri> --stack cad
```

where document uri is a URL to a drawing in a workspace of an existing document that you have write access to.  For example, this is a possible document uri:

```
https://cad.onshape.com/documents/61c4c3f6c490bac4c9db5d58/w/289385821d88d91849a7cd70/e/ae3c0bd456a8cd3f3d40dddc
```

and "--stack cad" is telling the sample which credentials to use from the credentials.json file.

If you are working with a company, you can specify an optional argument:

```
  --companyId=XXXX
```

to pick the correct company.

#### Logging

The application logs both to console and a file **logs/scriptname.log** . Both of these can be configured by **utils/logger.ts** .
Refer to [log4js](https://log4js-node.github.io/log4js-node/) for additional logging configurations.


#### Visual Studio Code

Using the **Visual Studio Code** IDE is **HIGHLY** recommended to edit this sample code, add additional tasks, debug and run the tasks.  The advantages of Visual Studio Code are:

1. Style and eslint settings are preconfigured for Visual Studio Code workspace.
2. Debugging various scripts is already setup in **launch.json**.  You can edit that file - launch.json - to set the documenturi, stack and companyId values for each task for your situation.
3. You can pick which task to run in the **Run and Debug** panel on the left side.  There's a dropdown at the top where you can choose the task to run and debug.
4. You can pick **Tasks: Run Build Task** -> **tsc: watch** to ensure the javascript files are compiled on edit for debugging, which allows you to avoid running npm run build after every code change.
