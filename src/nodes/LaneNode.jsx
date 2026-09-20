import { memo } from 'react';

// Background band of one swimlane. Not interactive: it only carries a label and a size.
const LaneNode = ({ data }) => (
    <div className="lane-band" style={{ width: data.width, height: data.height }}>
        <span className="lane-band-label">{data.label}</span>
    </div>
);

export default memo(LaneNode);
