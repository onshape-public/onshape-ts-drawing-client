import timeSpan from 'time-span';
import { mainLog } from './utils/logger.js';
import { ApiClient } from './utils/apiclient.js';
import { BasicNode } from './utils/onshapetypes.js';
import { usage, waitForModifyToFinish, DrawingScriptArgs, parseDrawingScriptArgs, validateBaseURLs, getRandomLocation } from './utils/drawingutils.js';

const LOG = mainLog();

let drawingScriptArgs: DrawingScriptArgs = null;
let validArgs: boolean = true;
let apiClient: ApiClient = null;

try {
  drawingScriptArgs = parseDrawingScriptArgs();
  apiClient = await ApiClient.createApiClient(drawingScriptArgs.stackToUse);
  validateBaseURLs(apiClient.getBaseURL(), drawingScriptArgs.baseURL);
} catch (error) {
  validArgs = false;
  usage('create-tab;e');
}

if (validArgs) {
  try {
    LOG.info(`documentId=${drawingScriptArgs.documentId}, workspaceId=${drawingScriptArgs.workspaceId}, elementId=${drawingScriptArgs.elementId}`);
  
    const randomLocation: number[] = getRandomLocation([1.0, 1.0], [8.0, 8.0]);
    const titleTextHeight = 0.156;
    const headerTextHeight = 0.12;
    const textHeight = 0.12;
  
    /**
     * Modify the drawing to create a table
     */
    const modifyRequest = await apiClient.post(`api/v6/drawings/d/${drawingScriptArgs.documentId}/w/${drawingScriptArgs.workspaceId}/e/${drawingScriptArgs.elementId}/modify`,  {
      description: "Add table",
      jsonRequests: [ {
        messageName: 'onshapeCreateAnnotations',
        formatVersion: '2021-01-01',
        "annotations": [
          {
            "table": {
              "cells": [
                {
                  "alignment": {
                    "alignment": "kMiddleCenter"
                  },
                  "column": 0,
                  "content": "Title",
                  "contentColor": {
                    "blue": 255,
                    "colorType": "",
                    "green": 255,
                    "red": 255
                  },
                  "isMerged": true,
                  "maxCol": 1,
                  "maxRow": 0,
                  "minCol": 0,
                  "minRow": 0,
                  "row": 0,
                  "textHeight": titleTextHeight
                },
                {
                  "alignment": {
                    "alignment": "kMiddleCenter"
                  },
                  "column": 0,
                  "content": "H1",
                  "contentColor": {
                    "blue": 255,
                    "colorType": "",
                    "green": 255,
                    "red": 255
                  },
                  "isMerged": false,
                  "maxCol": null,
                  "maxRow": null,
                  "minCol": null,
                  "minRow": null,
                  "row": 1,
                  "textHeight": headerTextHeight
                },
                {
                  "alignment": {
                    "alignment": "kMiddleLeft"
                  },
                  "column": 0,
                  "content": "C1,1",
                  "contentColor": {
                    "blue": 255,
                    "colorType": "",
                    "green": 255,
                    "red": 255
                  },
                  "isMerged": false,
                  "maxCol": null,
                  "maxRow": null,
                  "minCol": null,
                  "minRow": null,
                  "row": 2,
                  "textHeight": textHeight
                },
                {
                  "alignment": {
                    "alignment": "kMiddleLeft"
                  },
                  "column": 0,
                  "content": "C2,1",
                  "contentColor": {
                    "blue": 255,
                    "colorType": "",
                    "green": 255,
                    "red": 255
                  },
                  "isMerged": false,
                  "maxCol": null,
                  "maxRow": null,
                  "minCol": null,
                  "minRow": null,
                  "row": 3,
                  "textHeight": textHeight
                },
                {
                  "alignment": {
                    "alignment": "kMiddleCenter"
                  },
                  "column": 1,
                  "content": "",
                  "contentColor": {
                    "blue": 255,
                    "colorType": "",
                    "green": 255,
                    "red": 255
                  },
                  "isMerged": true,
                  "maxCol": 1,
                  "maxRow": 0,
                  "minCol": 0,
                  "minRow": 0,
                  "row": 0,
                  "textHeight": titleTextHeight
                },
                {
                  "alignment": {
                    "alignment": "kMiddleCenter"
                  },
                  "column": 1,
                  "content": "H2",
                  "contentColor": {
                    "blue": 255,
                    "colorType": "",
                    "green": 255,
                    "red": 255
                  },
                  "isMerged": false,
                  "maxCol": null,
                  "maxRow": null,
                  "minCol": null,
                  "minRow": null,
                  "row": 1,
                  "textHeight": headerTextHeight
                },
                {
                  "alignment": {
                    "alignment": "kMiddleLeft"
                  },
                  "column": 1,
                  "content": "C1,2",
                  "contentColor": {
                    "blue": 255,
                    "colorType": "",
                    "green": 255,
                    "red": 255
                  },
                  "isMerged": false,
                  "maxCol": null,
                  "maxRow": null,
                  "minCol": null,
                  "minRow": null,
                  "row": 2,
                  "textHeight": textHeight
                },
                {
                  "alignment": {
                    "alignment": "kMiddleLeft"
                  },
                  "column": 1,
                  "content": "C2,2",
                  "contentColor": {
                    "blue": 255,
                    "colorType": "",
                    "green": 255,
                    "red": 255
                  },
                  "isMerged": false,
                  "maxCol": null,
                  "maxRow": null,
                  "minCol": null,
                  "minRow": null,
                  "row": 3,
                  "textHeight": textHeight
                }
              ],
              "columns": 2,
              "formatting": {
                "fixedCorners": "FixedCornerTopRight",
                "flowDirection": "TtoB",
                "minTableHeight": null,
                "minTableWidth": null,
                "styleByRowType": [
                  {
                    "alignment": null,
                    "contentColor": null,
                    "rowType": {
                      "alignmentType": "kTitleRow"
                    }
                  },
                  {
                    "alignment": null,
                    "contentColor": null,
                    "rowType": {
                      "alignmentType": "kHeaderRow"
                    }
                  },
                  {
                    "alignment": null,
                    "contentColor": null,
                    "rowType": {
                      "alignmentType": "kDataRow"
                    }
                  },
                  {
                    "alignment": null,
                    "contentColor": null,
                    "rowType": {
                      "alignmentType": "kDataRow"
                    }
                  },
                  {
                    "alignment": null,
                    "contentColor": null,
                    "rowType": {
                      "alignmentType": "kTitleRow"
                    }
                  },
                  {
                    "alignment": null,
                    "contentColor": null,
                    "rowType": {
                      "alignmentType": "kHeaderRow"
                    }
                  },
                  {
                    "alignment": null,
                    "contentColor": null,
                    "rowType": {
                      "alignmentType": "kDataRow"
                    }
                  },
                  {
                    "alignment": null,
                    "contentColor": null,
                    "rowType": {
                      "alignmentType": "kDataRow"
                    }
                  }
                ],
                "tableColumnWidth": [
                  {
                    "columnIndex": 0,
                    "columnWidth": 0.78740157480315
                  },
                  {
                    "columnIndex": 1,
                    "columnWidth": 0.78740157480315
                  }
                ],
                "tableHeight": 1.208,
                "tableRowHeight": [
                  {
                    "rowHeight": 0.328,
                    "rowIndex": 0
                  },
                  {
                    "rowHeight": 0.32,
                    "rowIndex": 1
                  },
                  {
                    "rowHeight": 0.28,
                    "rowIndex": 2
                  },
                  {
                    "rowHeight": 0.28,
                    "rowIndex": 3
                  }
                ],
                "tableWidth": 1.5748031496063
              },
              "horizontalCellMargin": 0,
              "position": {
                "coordinate": randomLocation,
                "type": "Onshape::Reference::Point"
              },
              "rows": 4,
              "suppressHeaderRow": false,
              "suppressTitleRow": false,
              "type": null,
              "verticalCellMargin": 0
            },
            "type": "Onshape::Table::GeneralTable"
          }
        ]
      }]
    }) as BasicNode;
  
    const waitSucceeded: boolean = await waitForModifyToFinish(apiClient, modifyRequest.id);
    if (waitSucceeded) {
      console.log('Successfully created table.');
      LOG.info(`Successfully created table.`);
    } else {
      console.log('Create table failed waiting for modify to finish.');
      LOG.info('Create table failed waiting for modify to finish.');
    }
  } catch (error) {
    console.error(error);
    LOG.error('Create table failed', error);
  }
}