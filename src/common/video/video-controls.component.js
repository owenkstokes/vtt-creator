import * as React from 'react';
import * as PropTypes from 'prop-types';
import LinearProgress from '@material-ui/core/LinearProgress';
import Typography from '@material-ui/core/Typography';
import FullscreenIcon from '@material-ui/icons/Fullscreen';
import FullscreenExitIcon from '@material-ui/icons/FullscreenExit';
import PauseIcon from '@material-ui/icons/Pause';
import PlayIcon from '@material-ui/icons/PlayArrow';
import { makeStyles } from '@material-ui/styles';
import { useVideoEvents } from './video-controls.context';
import IconToggle from './icon-toggle.component';
import VolumeInput from './volume-input.component';
import { isFullScreenEnabled } from './use-fullscreen.hook';

const useStyles = makeStyles({
	controlBar: {
		color: 'white',
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'spaceBetween',
		marginBottom: 4,
	},
	controlGroupLeft: {
		flex: 1,
		display: 'flex',
		alignItems: 'center',
	},
	controlLeft: {
		marginRight: 4,
	},
	controlGroupRight: {
		flex: 1,
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'flex-end',
	},
	controlRight: {
		marginLeft: 4,
	},
});

VideoControls.propTypes = {
	className: PropTypes.string,
};

export default function VideoControls({ className }) {
	const {
		duration,
		currentTime,
		paused,
		fullscreen,
		volume,
		muted,
		onPlayPause,
		onToggleFullscreen,
		onVolumeChange,
		onToggleMute,
	} = useVideoEvents();
	const classes = useStyles();
	const progress = duration ? (currentTime / duration) * 100 : 0;
	return (
		<div className={className}>
			<div className={classes.controlBar}>
				<div className={classes.controlGroupLeft}>
					<div className={classes.controlLeft}>
						<IconToggle
							on={paused}
							onIcon={<PlayIcon />}
							offIcon={<PauseIcon />}
							aria-label="Play/Pause"
							size="small"
							color="inherit"
							edge="start"
							onToggle={onPlayPause}
						/>
					</div>
					<div className={classes.controlLeft}>
						<Typography variant="subtitle2">
							{formatSeconds(currentTime)} / {formatSeconds(duration)}
						</Typography>
					</div>
				</div>
				<div className={classes.controlGroupRight}>
					<div className={classes.controlRight}>
						<VolumeInput
							value={volume}
							muted={muted}
							onChange={(e, v) => onVolumeChange(parseFloat(v))}
							onToggleMute={onToggleMute}
						/>
					</div>
					{isFullScreenEnabled() && (
						<div className={classes.controlRight}>
							<IconToggle
								on={fullscreen}
								onIcon={<FullscreenExitIcon />}
								offIcon={<FullscreenIcon />}
								aria-label="Toggle fullscreen"
								size="small"
								color="inherit"
								onToggle={onToggleFullscreen}
							/>
						</div>
					)}
				</div>
			</div>
			<LinearProgress variant="determinate" value={progress} />
		</div>
	);
}

function formatSeconds(decSeconds) {
	if (isNaN(decSeconds)) return '0:00';
	const min = Math.floor(decSeconds / 60);
	const sec = Math.floor(decSeconds % 60);
	return `${min}:${formatTimeUnit(sec, 2)}`;
}

function formatTimeUnit(unit, width) {
	if (!unit) return '0'.repeat(width);
	return unit.toString().padStart(width, '0');
}
