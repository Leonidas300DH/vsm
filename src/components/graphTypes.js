import SubprocessNode from '../nodes/SubprocessNode';
import ProcessNode from '../nodes/ProcessNode';
import StartEndNode from '../nodes/StartEndNode';
import FlowEdge from '../edges/FlowEdge';
export const nodeTypes = { subprocess: SubprocessNode, process: ProcessNode, startEnd: StartEndNode };
export const edgeTypes = { flow: FlowEdge };
