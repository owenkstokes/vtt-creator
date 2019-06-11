import * as React from 'react';
import * as PropTypes from 'prop-types';
import { makeStyles } from '@material-ui/styles';
import { CuePropType } from '../services/vtt.service';
import CueHandleBorder from './cue-handle-border.component';
import { useZoom } from './zoom-container.component';

const useStyles = makeStyles({
	cue: {
		position: 'absolute',
		top: 0,
		bottom: 0,
	},
	borderHandleContainer: {
		position: 'relative',
		height: '100%',
	},
	content: {
		height: '100%',
	},
	leftBorder: {
		left: -10,
	},
	rightBorder: {
		right: -10,
	},
});

CueHandle.propTypes = {
	cue: CuePropType.isRequired,
	cueIndex: PropTypes.number,
	onChange: PropTypes.func.isRequired,
	children: PropTypes.node,
};

export default function CueHandle({ cue, cueIndex, onChange, children }) {
	const [left, setLeft] = React.useState(0);
	const [right, setRight] = React.useState(0);
	const { pixelsPerSec, zoomContainerRect } = useZoom();
	const classes = useStyles();
	const containerWidth = zoomContainerRect ? zoomContainerRect.width : 0;
	const containerLeft = zoomContainerRect ? zoomContainerRect.left : 0;

	React.useEffect(() => {
		if (pixelsPerSec) {
			setLeft(Math.round(cue.startTime * pixelsPerSec));
		}
	}, [pixelsPerSec, cue.startTime]);

	React.useEffect(() => {
		if (pixelsPerSec) {
			setRight(Math.round(containerWidth - cue.endTime * pixelsPerSec));
		}
	}, [pixelsPerSec, cue.endTime, containerWidth]);

	const onDraggingLeft = React.useCallback(
		e => {
			setLeft(e.clientX - containerLeft);
		},
		[containerLeft]
	);

	const onDraggingRight = React.useCallback(
		e => {
			setRight(containerWidth - (e.clientX - containerLeft));
		},
		[containerLeft, containerWidth]
	);

	const onDragEndLeft = React.useCallback(
		e => {
			const newStartTime = (e.clientX - containerLeft) / pixelsPerSec;
			onChange(new VTTCue(newStartTime, cue.endTime, cue.text), cueIndex, true);
		},
		[containerLeft, pixelsPerSec, cue.endTime, cue.text, cueIndex, onChange]
	);

	const onDragEndRight = React.useCallback(
		e => {
			const newEndTime = (e.clientX - containerLeft) / pixelsPerSec;
			onChange(new VTTCue(cue.startTime, newEndTime, cue.text), cueIndex);
		},
		[containerLeft, pixelsPerSec, onChange, cue.startTime, cue.text, cueIndex]
	);

	return (
		<div className={classes.cue} style={{ left, right }}>
			<div className={classes.borderHandleContainer}>
				<div className={classes.content}>{children}</div>
				<CueHandleBorder className={classes.leftBorder} onDragging={onDraggingLeft} onDragEnd={onDragEndLeft} />
				<CueHandleBorder className={classes.rightBorder} onDragging={onDraggingRight} onDragEnd={onDragEndRight} />
			</div>
		</div>
	);
}
