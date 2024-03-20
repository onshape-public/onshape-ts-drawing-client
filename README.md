#### Description
Sample Onshape Drawing API client in typescript

#### Requirements
Git, Nodejs and Npm should be installed. **credentials.json** should be populated (see end of this README for instructions to create it)

#### Building
Clone this github repo locally and run the below command to install all the dependencies and do a build first

    $ npm run build

----------------------------------------------------------------------------------------------------
# Examples section

Listed are the various workflows samples included in this repo. All examples make **Onshape API** calls
and need a valid **credentials.json**.  Please refer to **Storing credentials** section down below.

## Create note example
    $ npm run create-note  --did=aa8e16d5387740ee4bacad61 --wid=tbd --eid=tbd

This application will create a note in a drawing with the given document, workspace and element ids.
Here **aa8e16d5387740ee4bacad61** is the onshape id of the document. You can get this id by navigating to the drawing
in the webclient like so

    $  https://cad.onshape.com/documents?nodeId=aa8e16d5387740ee4bacad61&resourceType=folder

What the **Create note** does

* Find active sheet in the given drawing
    * Creates a note in that active sheet
* Generate **./reports/folder/references.csv** report containing all documents involved and whether any of them are not contained in the folder.


----------------------------------------------------------------------------------------------------

#### Storing credentials in *credentials.json*
This sample expects api keys to make onshape api calls.  Use dev portal to generate api keys as a company admin and
save in this format in the same folder as **credentials.json**

    {
        "cad": {
            "url": "https://cad.onshape.com/",
            "accessKey": "XXXXXXXXXXXXXXX",
            "secretKey": "YYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY"
        }
    }

#### Logging

The application logs both to console and a file called **logs/scriptname.log** . Both of these can be configured by **utils/logger.ts**
Refer to [log4js](https://log4js-node.github.io/log4js-node/) for additional logging configurations


#### Additional information

The credentials file can store multiple api keys. For all of the scripts you can specify an extra argument

>  --stack=cad

as needed to pick the right credentials.

If you are member of multiple companies you can specify an extra argument

>  --companyId=XXXX

to pick the right company Id. You can also save it as a **companyId** field in your credentials.json

#### Editing in Visual Studio Code

To customize any of these scripts or add additional ones, using **Visual Studio Code** IDE is highly recommended.

1. Style and eslint settings are preconfigured for Visual Studio Code workspace.
2. Debugging various scripts are already setup in **lauch.json**
3. Simply pick **Tasks: Run Build Task** -> **tsc: watch** to ensure the javascript files are compiled on edit for debugging
