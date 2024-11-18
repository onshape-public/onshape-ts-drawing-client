#### Description
Sample Onshape Drawing API client in typescript.

This sample has a long set of possible scripts that can be run, all of the form

	$ npm run xxx

where xxx is a script name, often followed by arguments.

Note this repository shares an approach with the Onshape public repository

https://github.com/onshape-public/onshape-ts-client

You are encouraged to also look at that repository for non-drawings Onshape examples.

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
    
Note that the tsconfig.json file has a line in it:

```
    "watch": true
```

When you do 'npm run build', due to this setting, the Typescript compiler will automatically start watching for file changes and will rebuild every time you change and save a file in the project.
If you do not want this behavior, then you can change the watch value to false.  But after that you will need to rebuild manually after each code change.

#### Running Sample Scripts

After building, you can run any of these sample scripts from the terminal command line.

```
npm run create-note --drawinguri=<drawing uri> --stack=cad

npm run create-note-with-leader --drawinguri=<drawing uri> --stack=cad

npm run create-callout --drawinguri=<drawing uri> --stack=cad

npm run create-callout-with-leader --drawinguri=<drawing uri> --stack=cad

npm run create-geometric-tolerance --drawinguri=<drawing uri> --stack=cad

npm run create-table --drawinguri=<drawing uri> --stack=cad

npm run create-centerline --drawinguri=<drawing uri> --stack=cad

npm run create-point-to-point-linear-dimension --drawinguri=<drawing uri> --stack=cad

npm run create-point-to-line-linear-dimension --drawinguri=<drawing uri> --stack=cad

npm run create-line-to-line-linear-dimension --drawinguri=<drawing uri> --stack=cad

npm run create-line-to-line-angular-dimension --drawinguri=<drawing uri> --stack=cad

npm run create-three-point-angular-dimension --drawinguri=<drawinguri> --stack=cad

npm run create-radial-dimension --drawinguri=<drawing uri> --stack=cad

npm run create-diameter-dimension --drawinguri=<drawing uri> --stack=cad

npm run create-inspection-symbols --drawinguri=<drawing uri> --stack=cad

npm run create-aligned-linear-dimension --drawinguri=<drawing uri> --stack=cad

npm run detect-if-single-drawing-needs-update --drawinguri=<drawing uri> --stack=cad

npm run detect-if-workspace-contains-drawings-needing-update --drawinguri=<drawing uri> --stack=cad

npm run edit-notes --drawinguri=<drawing uri> --stack=cad

npm run edit-dimension-attachments --drawinguri=<drawing uri> --stack=cad

npm run edit-dimension-text-positions --drawinguri=<drawing uri> --stack=cad

npm run find-errors-in-drawing --drawinguri=<drawing uri> --stack=cad
```

For scripts that create or edit the drawing, the drawinguri argument should be to a drawing in a document to which you have edit access.  The drawing should be in a workspace and have a view that has edges that are lines, arcs and circles. The sample code will pick a view and some of those edges when creating dimensions. For example, this is a possible drawing uri:

```
https://cad.onshape.com/documents/61c4c3f6c490bac4c9db5d58/w/289385821d88d91849a7cd70/e/ae3c0bd456a8cd3f3d40dddc
```

and "--stack=cad" is telling the sample which credentials to use from the credentials.json file.

If you are working with a company, you can specify an optional argument:

```
  --companyId=XXXX
```

to pick the correct company.

For scripts that only query the drawing (e.g. find-errors-in-drawing), you only need read access to the document and the drawing can be in a version.

#### Logging

The application logs both to console and a file **logs/scriptname.log** . Both of these can be configured by **utils/logger.ts** .
Refer to [log4js](https://log4js-node.github.io/log4js-node/) for additional logging configurations.

#### Visual Studio Code

Using the **Visual Studio Code** IDE is **HIGHLY** recommended to edit this sample code, add additional scripts, debug and run the scripts.  The advantages of Visual Studio Code are:

1. Style and eslint settings are preconfigured for Visual Studio Code workspace.
2. Debugging various scripts is already setup in **launch.json**.  You can edit that file - launch.json - to set the drawinguri, stack and companyId values for each script for your situation.
3. You can pick which script to run in the **Run and Debug** panel on the left side.  There's a dropdown at the top where you can choose the script to run and debug.
