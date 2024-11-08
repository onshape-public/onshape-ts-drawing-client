
export interface BasicNode {
  id: string;
  name?: string;
  description?: string;
  href?: string;
}

export interface NodeOwner extends BasicNode {
  type: number;
}

export interface CompanyInfo extends BasicNode {
  admin: boolean;
  domainPrefix?: string;
}

export const DOCUMENT_SUMMARY = 'document-summary';
export const FOLDER = 'folder';
export type JsonType = 'document-summary' | 'folder';

export interface GlobalNode extends BasicNode {
  jsonType?: JsonType;
  owner?: NodeOwner;
  createdBy?: NodeOwner;
  modifiedBy?: NodeOwner;
}

export interface DocumentNode extends GlobalNode {
  defaultWorkspace?: BasicNode;
  parentId?: string;
}

export interface AElementExtRef {
  documentId?: string;
  versionId?: string;
  id?: string;
}

export interface WorkspaceRef {
  documents?: BasicNode[];
  elementExternalReferences?: Record<string, AElementExtRef[]>;
  elementRevisionReferences?: Record<string, AElementExtRef[]>;
}

export interface ListResponse<Type> {
  previous?: string;
  next?: string;
  href?: string;
  items?: Type[];
}

export interface GlobalNodeList extends ListResponse<GlobalNode & Record<string, string | number | boolean>> {
}

export interface Revision extends BasicNode {
  partNumber: string;
  revision: string;
  companyId: string;
  documentId: string;
  versionId: string;
  elementId: string;
  partId?: string;
  elementType: ElementType;
  configuration?: string;
  mimeType?: string;
  createdAt?: string;
  viewRef?: string;
}

export enum ElementType {
  PARTSTUDIO,
  ASSEMBLY,
  DRAWING,
  FEATURESTUDIO,
  BLOB,
  APPLICATION,
  TABLE,
  BILLOFMATERIALS,
  UNKNOWN
}

export class Constants {
  static ONSHAPE_WORKFLOW_ID = '59b944bcd71eb79518f2176c';
  static RP_NAME_ID = '594964b7040fc85d2b418138';
  static RP_NOTES_ID = '594964df040fc85d2b418144';
  static RP_COMMENT_ID = '594964df040fc85d2b418145';
  static INCLUDED_IN_RELEASE_PACKAGE_PROPERTY_ID = '59496ecb040fc85d2b41839c';
  static PROPERTY_ID_PREVIOUS_REVISION = '59496726040fc85d2b4181be';
  static NOT_REVISION_MANAGED_ID = '57f3fb8efa3416c06701d61d';
  static PART_NUMBER_ID = '57f3fb8efa3416c06701d60f';
  static NAME_ID = '57f3fb8efa3416c06701d60d';
  static STATE_ID = '57f3fb8efa3416c06701d611';
  static REVISION_ID = '57f3fb8efa3416c06701d610';
}

export interface MetadataProperty {
  propertyId: string;
  editable: boolean;
  value: string | number | boolean;
  defaultValue: string | number | boolean;
}

export interface ElementMetadata {
  parts?: { items?: Record<string, string>[] };
  href: string;
  mimeType?: string;
  elementType: ElementType;
  properties: MetadataProperty[];
}

export enum ErrorSeverity {
  OK,
  INFO,
  WARNING,
  ERROR
}

export interface ReleaseItemErrors {
  message: string;
  severity: ErrorSeverity;
}

export interface ReleasePackageItem extends BasicNode {
  documentId?: string;
  workspaceId?: string;
  versionId?: string;
  elementId: string;
  partId?: string;
  viewRef?: string;
  children: ReleasePackageItem[];
  errors: ReleaseItemErrors[];
  properties: MetadataProperty[];
}

export interface ReleasePackage extends BasicNode {
  properties: MetadataProperty[];
  items: ReleasePackageItem[];
  documentId: string;
}

export type PROPERTY_TYPES = string | number | boolean;

export interface PropertyUpdate {
  propertyId: string;
  value: PROPERTY_TYPES;
}

export interface ReleasePackageItemUpdate {
  id: string;
  href: string;
  documentId: string;
  workspaceId?: string;
  versionId?: string;
  elementId: string;
  properties: PropertyUpdate[];
}

// Drawings types

export class DrawingObjectType {
  static CALLOUT = 'Onshape::Callout';
  static CENTERLINE_POINT_TO_POINT = 'Onshape::Centerline::PointToPoint';
  static CENTERLINE_LINE_TO_LINE = 'Onshape::Centerline::LineToLine';
  static CENTERLINE_TWO_POINT_CIRCULAR = 'Onshape::Centerline::TwoPointCircleCenterline';
  static CENTERLINE_THREE_POINT_CIRCULAR = 'Onshape::Centerline::ThreePointCircleCenterline';
  static CHAMFER_NOTE = 'Onshape::Dimension::ChamferNote';
  static DIMENSION_DIAMETER = 'Onshape::Dimension::Diametric';
  static DIMENSION_LINE_TO_LINE_ANGULAR = 'Onshape::Dimension::LineToLineAngular';
  static DIMENSION_LINE_TO_LINE_LINEAR = 'Onshape::Dimension::LineToLine';
  static DIMENSION_POINT_TO_LINE_LINEAR = 'Onshape::Dimension::PointToLine';
  static DIMENSION_POINT_TO_POINT_LINEAR = 'Onshape::Dimension::PointToPoint';
  static DIMENSION_RADIAL = 'Onshape::Dimension::Radial';
  static DIMENSION_THREE_POINT_ANGULAR = 'Onshape::Dimension::ThreePointAngular';
  static GEOMETRIC_TOLERANCE = 'Onshape::GeometricTolerance';
  static INSPECTION_SYMBOL = 'Onshape::InspectionSymbol';
  static NOTE = 'Onshape::Note';
  static TABLE = 'Onshape::Table::GeneralTable';
}

export class SnapPointType {
  static ModeApint = 'ModeApint';       // Apparent intersection
  static ModeCenter = 'ModeCenter';     // Center point
  static ModeEnd = 'ModeEnd';           // End point
  static ModeIns = 'ModeIns';           // Insertion point
  static ModeIntersec = 'ModeIntersec'; // Intersection
  static ModeMid = 'ModeMid';           // Midpoint
  static ModeNear = 'ModeNear';         // Nearest point
  static ModeNode = 'ModeNode';         // Node
  static ModePar = 'ModePar';           // Parallel
  static ModePerp = 'ModePerp';         // Perpendicular
  static ModeQuad = 'ModeQuad';         // Quadrant
  static ModeStart = 'ModeStart';       // Start point
  static ModeTan = 'ModeTan';           // Tangent point
}

export class ErrorStateValue {
  static OK = 0;        // Healthy
  static INFO = 1;      // Information
  static WARNING = 2;   // Warning
  static ERROR = 3;     // Error - currently either isDangling annotation or view with view generation error
  static UNKNOWN = 4;   // Unknown
}

export interface ErrorState {
  value: ErrorStateValue;
  description: string;
}

// View object returned from api/appelements/d/did/wv/wvid/e/eid/views/ API
export interface View1 {
  associativityChangeId: string;
  bomReferenceId: string;
  brokenOutBBoxes: Object;
  brokenOutEndConditions: [];
  brokenOutPointNumbers: [];
  computeIntersection: boolean;
  cutPoint: [];
  displayStateId: string;
  errorCode: number;
  explodedViewId: string;
  hiddenLines: string;
  ignoreFaultyParts: boolean;
  includeHiddenInstances: boolean;
  includeSurfaces: boolean;
  includeWires: boolean;
  isAlignedSection: boolean;
  isBrokenOutSection: boolean;
  isCopiedView: boolean;
  isCropView: boolean;
  isPartialSection: boolean;
  isSectionOfAlignedSection: boolean;
  isSectionOfSectionOnBase: boolean;
  isSurface: boolean;
  modelReferenceId: string;
  modificationId: string;
  namedPositionId: string;
  occurrenceOrQueryToGeometryProperties: Object;
  offsetSectionPoints: [];
  parentViewId: string;
  perspective: boolean;
  projectionAngle: string;
  qualityOption: number;
  renderSketches: boolean;
  showAutoCenterlines: boolean;
  showAutoCentermarks: boolean;
  showCutGeomOnly: boolean;
  showTangentLines: boolean;
  showThreads: boolean;
  showViewingPlane: boolean;
  sectionId: string;
  simplificationOption: number;
  simplificationThreshold: number;
  useParentViewSectionData: boolean;
  viewDirection: [];
  viewId: string;
  viewMatrix: number[];
  viewVersion: number;
}

export interface GetDrawingViewsResponse {
  items: View1[];
}

// View object returned from api/drawings/d/did/wv/wvid/e/eid/translations API with DRAWING_JSON format
export interface View2 {
  bomReference: string;
  errorState?: ErrorState;
  label: string;
  name: string;
  orientation: string;
  position: {
    x: number;
    y: number;
  };
  renderMode: string;
  rotation?: number;
  scale: {
    denumerator: number;
    numerator: number;
    scaleSource: string;
  };
  sheet: string;
  showScaleLabel: boolean;
  simplification: string;
  tangentEdges: string;
  type: string;
  viewId: string;
  viewToPaperMatrix: {
    items: number[];
  };
}

// Response from api/drawings/d/did/wv/wvid/e/eid/translations API
export interface ExportDrawingResponse {
  failureReason: string;
  id: string;
  requestState: string;
}

export interface TranslationStatusResponse {
  failureReason: string;
  id: string;
  requestState: string;
  resultExternalDataIds: string[];
}

export interface EdgeData {
  center?: number[];
  axisDir?: number[];
  radius?: number;
  start?: number[];
  end?: number[];
}

export interface Edge {
  type: string;
  visible: boolean;
  deterministicId: string;
  rightRepOccurrences: string[];
  uniqueId: string;
  geometryClass: string;
  data: EdgeData;
}

export interface AssociatedEdge {
  type: string;
  uniqueId: string;
  viewId: string;
}

export interface GetViewJsonGeometryResponse {
  bodyData: Edge[];
}

export interface DimensionFormatting {
  dimdec?: number;
  dimlim?: boolean;
  dimpost?: string;
  dimtm?: number;
  dimtol?: boolean;
  dimtp?: number;
  type?: string;
}

export interface AssociatedPoint {
  coordinate?: number[];
  type?: string;
  uniqueId?: string;
  viewId?: string;
  snapPointType?: SnapPointType;
}

export interface UnassociatedPoint {
  coordinate: number[];
  type: string;
}

export interface DimensionUnit {
  dimaunit: Object;
  dimlunit: Object;
  insUnit: Object;
  unit: string;
}

export interface LeaderPosition {
  coordinate: number[];
  type: DrawingObjectType;
  uniqueId: string;
  viewId: string;
  snapPointType: SnapPointType;
}

export interface Callout {
  borderShape: string;
  borderSize: number;
  contents: string;
  contentsBottom: string;
  contentsLeft: string;
  contentsRight: string;
  contentsTop: string;
  isDangling: boolean;
  leaderPosition?: LeaderPosition;
  logicalId: string;
  position: UnassociatedPoint;
  textHeight: number;
}

export interface GeometricTolerance {
  boundingBoxPoint: UnassociatedPoint[];
  frames: string[];
  isDangling: boolean;
  leaderPosition?: LeaderPosition;
  logicalId: string;
  position: UnassociatedPoint;
}

export interface Note {
  contents?: string;
  isDangling?: boolean;
  leaderPosition?: LeaderPosition;
  logicalId?: string;
  position?: UnassociatedPoint;
  textHeight?: number;
}

export interface ChamferNote {
  displayedValue: string;
  edge1End: AssociatedPoint;
  edge1Start: AssociatedPoint;
  edge2End: AssociatedPoint;
  edge2Start: AssociatedPoint;
  formatting?: DimensionFormatting;
  isDangling?: boolean;
  logicalId: string;
  measurementAngle: number;
  measurementLength: number;
  secondUnit: DimensionUnit;
  textOverride: string;
  textPosition: UnassociatedPoint;
  unit: DimensionUnit;
}

export interface PointToPointCenterline {
  isDangling: boolean;
  logicalId: string;
  point1: AssociatedPoint;
  point2: AssociatedPoint;
}

export interface LineToLineCenterline {
  isDangling?: boolean;
  logicalId: string;
  edge1: AssociatedEdge;
  edge2: AssociatedEdge;
}

export interface TwoPointCircleCenterline {
  isDangling?: boolean;
  logicalId: string;
  centerPoint: AssociatedPoint;
  defPoint: AssociatedPoint;
}

export interface ThreePointCircleCenterline {
  isDangling?: boolean;
  logicalId: string;
  point1: AssociatedPoint;
  point2: AssociatedPoint;
  point3: AssociatedPoint;
}

export interface PointToPointLinearDimension {
  formatting?: DimensionFormatting;
  isDangling?: boolean;
  logicalId?: string;
  measurement?: number;
  point1?: AssociatedPoint;
  point2?: AssociatedPoint;
  textOverride?: string;
  textPosition?: UnassociatedPoint;
  unit?: DimensionUnit;
}

export interface LineToLineAngularDimension {
  arcPoint: UnassociatedPoint;
  formatting: DimensionFormatting;
  isDangling: boolean;
  logicalId: string;
  measurement: number;
  point1: AssociatedPoint;
  point2: AssociatedPoint;
  point3: AssociatedPoint;
  point4: AssociatedPoint;
  textOverride: string;
  textPosition: UnassociatedPoint;
  unit: DimensionUnit;
}

export interface ThreePointAngularDimension {
  arcPoint: UnassociatedPoint;
  center: AssociatedPoint;
  formatting: DimensionFormatting;
  isDangling: boolean;
  logicalId: string;
  measurement: number;
  point1: AssociatedPoint;
  point2: AssociatedPoint;
  textOverride: string;
  textPosition: UnassociatedPoint;
  unit: DimensionUnit;
}

export interface LineToLineLinearDimension {
  edge1: AssociatedEdge;
  edge2: AssociatedEdge;
  formatting: DimensionFormatting;
  isDangling: boolean;
  logicalId: string;
  measurement: number;
  textOverride: string;
  textPosition: UnassociatedPoint;
  unit: DimensionUnit;
}

export interface PointToLineLinearDimension {
  edge: AssociatedEdge;
  formatting: DimensionFormatting;
  isDangling: boolean;
  logicalId: string;
  measurement: number;
  point: AssociatedPoint;
  rotation: number;
  textOverride: string;
  textPosition: UnassociatedPoint;
  unit: DimensionUnit;
}

export interface DiameterDimension {
  chordPoint: AssociatedPoint;
  farChordPoint: AssociatedPoint;
  formatting: DimensionFormatting;
  isDangling: boolean;
  logicalId: string;
  measurement: number;
  textOverride: string;
  textPosition: UnassociatedPoint;
  unit: DimensionUnit;
}

export interface RadialDimension {
  centerPoint: AssociatedPoint;
  chordPoint: AssociatedPoint;
  formatting: DimensionFormatting;
  isDangling: boolean;
  logicalId: string;
  measurement: number;
  textOverride: string;
  textPosition: UnassociatedPoint;
  unit: DimensionUnit;
}

export interface InspectionSymbol {
  borderShape: string;
  borderSize: number;
  isDangling?: boolean;
  itemParsing: string;
  logicalId: string;
  number: number;
  parentAnnotation: string;
  parentLineIndex: number;
  position: UnassociatedPoint;
  textHeight: number;
}

export interface Annotation {
  type: string;
  callout?: Callout;
  chamferNote?: ChamferNote;
  diametricDimension?: DiameterDimension;
  geometricTolerance?: GeometricTolerance;
  inspectionSymbol?: InspectionSymbol;
  lineToLineAngularDimension?: LineToLineAngularDimension;
  lineToLineCenterline?: LineToLineCenterline;
  lineToLineDimension?: LineToLineLinearDimension;
  note?: Note;
  pointToLineDimension?: PointToLineLinearDimension;
  pointToPointCenterline?: PointToPointCenterline;
  pointToPointDimension?: PointToPointLinearDimension;
  radialDimension?: RadialDimension;
  threePointAngularDimension?: ThreePointAngularDimension;
  threePointCircleCenterline?: ThreePointCircleCenterline;
  twoPointCircleCenterline?: TwoPointCircleCenterline;
}

export interface Sheet {
  active?: boolean;
  annotations: Annotation[];
  format: string;
  index: number;
  name: string;
  reference: string;
  scale: {
    denumerator: number,
    numerator: number
  };
  size: string;
  views: View2[];
}

export interface GetDrawingJsonExportResponse {
  sheets: Sheet[];
}

export class OverallRequestResultStatus {
  static OverallRequestSuccess = 'OK';                         // All requests succeeded
  static OverallRequestPartialSuccessed = 'Partial_success';   // Some requests succeeded, some failed
  static OverallRequestFailed = 'Failed';                      // All requests failed
}

export class SingleRequestResultStatus {
  static RequestSuccess = 'OK';       // Success
  static RequestFailed = 'Failed';    // Failed
}

export class SingleRequestType {
  static RequestTypeCreate = 'Create';
  static RequestTypeEdit = 'Edit';
  static RequestTypeDelete = 'Delete';
}
 
// The response to a single JSON request (create, edit, delete) of (annotation, view, sheet, etc.)
export interface SingleRequestResponse {
  status: SingleRequestResultStatus;
  logicalId?: string;         // Field exists and has a value if status is "OK"
  errorDescription?: string;  // Field exists and has a value if status is "Failed"
}
export interface ModifyStatusResponseOutput {
  status: OverallRequestResultStatus;
  statusCode: number;
  errorDescription?: string;  // Field exists and has a value if overall status is "Partial_success" or "Failed"
  changeId: string;
  results: SingleRequestResponse[];
}

export interface DrawingReference {
  targetElementMicroversionId: string;
  latestElementMicroversionId: string;
  resolvedElementMicroversionId: string;
  sourceElementId: string;
  idTagIsValid: boolean;
  targetDocumentId: string;
  targetVersionId: string;
  resolvedDocumentMicroversionId: string;
  targetElementId: string;
  targetConfiguration: string;
  changeId: string;
  idTag: string;
  referenceId: string;
  isLocked: boolean;
  targetDocumentMicroversionId: string;
  // There are more fields, but they are not needed here
}

export interface ResolveReferencesResponse {
  unresolvedReferences: DrawingReference[];
  resolvedReferences: DrawingReference[];
}

