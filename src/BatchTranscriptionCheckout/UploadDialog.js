import React from 'react'
import {
	Box,
	Button,
	Dialog,
	DialogActions,
	DialogTitle,
	Grid,
	IconButton,
	LinearProgress,
	List,
	ListItem,
	ListItemSecondaryAction,
	ListItemText,
	Snackbar,
	Tooltip,
	Typography,
	useMediaQuery,
} from '@material-ui/core'
import * as PropTypes from 'prop-types'
import MuiCancelledIcon from '@material-ui/icons/Cancel'
import CloseIcon from '@material-ui/icons/Close'
import MuiCompletedIcon from '@material-ui/icons/CheckCircle'
import MuiFailedIcon from '@material-ui/icons/Warning'
import FolderIcon from '@material-ui/icons/FolderOpen'
import {withStyles, styled} from '@material-ui/styles'
import {useUpload} from './UploadProvider'
import {useFileSelector} from '../common'

const Title = styled(DialogTitle)({
	display: 'flex',
	justifyContent: 'space-between',
	alignItems: 'center',
})

const CancelledLinearProgress = withStyles(theme => ({
	colorPrimary: {
		backgroundColor: theme.palette.grey[300],
	},
	bar: {
		backgroundColor: theme.palette.grey[500],
	},
}))(LinearProgress)

const FailedLinearProgress = withStyles(theme => ({
	bar: {
		backgroundColor: theme.palette.error.main,
	},
}))(LinearProgress)

const CompletedLinearProgress = withStyles(theme => ({
	bar: {
		backgroundColor: theme.palette.success.main,
	},
}))(LinearProgress)

const CancelledIcon = withStyles(theme => ({
	root: {
		color: theme.palette.text.disabled,
	},
}))(MuiCancelledIcon)

const FailedIcon = withStyles(theme => ({
	root: {
		color: theme.palette.error.main,
	},
}))(MuiFailedIcon)

const CompletedIcon = withStyles(theme => ({
	root: {
		color: theme.palette.success.main,
	},
}))(MuiCompletedIcon)

UploadDialog.propTypes = {
	open: PropTypes.bool.isRequired,
	batchId: PropTypes.string.isRequired,
	onOpen: PropTypes.func.isRequired,
	onClose: PropTypes.func.isRequired,
}

export default function UploadDialog({open, batchId, onOpen, onClose}) {
	const {uploadState, handleAddFiles, handleCancelFile, handleRemoveFile} = useUpload()

	const batchState = React.useMemo(() => uploadState.batches[batchId] || {uploading: false, uploads: []}, [
		uploadState.batches,
		batchId,
	])

	const handleFilesSelected = e => {
		handleAddFiles(batchId, [...e.target.files])
	}

	const openFileSelector = useFileSelector({accept: 'video/*', multiple: true, onFilesSelected: handleFilesSelected})

	const useMobileLayout = useMediaQuery(theme => theme.breakpoints.down('sm'))

	return (
		<React.Fragment>
			<Snackbar
				anchorOrigin={{vertical: 'bottom', horizontal: 'left'}}
				open={!open && batchState.uploading}
				message="Uploading files..."
				onClick={onOpen}
				action={
					<Button variant="contained" color="secondary" size="small" onClick={onOpen}>
						View
					</Button>
				}
			/>
			<Dialog
				maxWidth="md"
				fullWidth
				fullScreen={useMobileLayout}
				open={open}
				onClose={onClose}
				aria-labelledby="batch-upload-dialog">
				<Title disableTypography>
					<Typography variant="h6">Upload Files</Typography>
					<IconButton aria-label="Close" edge="end" onClick={onClose}>
						<CloseIcon />
					</IconButton>
				</Title>
				<Box px={2}>
					<Box px={4}>
						<Typography variant="body2" paragraph>
							Your uploads will continue in the background even if you close this dialog or navigate to a different page
							within VTT Creator.
						</Typography>
						<Typography variant="body2" paragraph>
							Don&apos;t close this tab or use it to navigate to a different site though, or any uploads in progress
							will be lost and you&apos;ll need to start them over.
						</Typography>
					</Box>
					<List disablePadding>
						{batchState.uploads.map(u => (
							<ListItem key={u.id}>
								<ListItemText
									disableTypography
									primary={
										<Grid container spacing={2}>
											<Grid item xs zeroMinWidth>
												<Typography noWrap>{u.file.name}</Typography>
											</Grid>
											<Grid item>
												<Typography align="right">{getProgressMessage(u.state, u.loaded, u.total)}</Typography>
											</Grid>
											<Grid item xs={12}>
												{getProgressBar(u.state, 100 * (u.loaded / u.total))}
											</Grid>
										</Grid>
									}
								/>
								<ListItemSecondaryAction>
									{u.state === 'queued' && !batchState.uploading && (
										<Tooltip title="Remove">
											<span>
												<IconButton edge="end" onClick={() => handleRemoveFile(batchId, u.id)}>
													<CloseIcon />
												</IconButton>
											</span>
										</Tooltip>
									)}
									{['queued', 'extracting', 'uploading'].includes(u.state) && batchState.uploading && (
										<Tooltip title="Cancel">
											<span>
												<IconButton edge="end" onClick={() => handleCancelFile(batchId, u.id)}>
													<CancelledIcon />
												</IconButton>
											</span>
										</Tooltip>
									)}
									{['adding'].includes(u.state) && (
										<IconButton edge="end" disabled>
											<CancelledIcon />
										</IconButton>
									)}
									{u.state === 'cancelled' && <CancelledIcon />}
									{u.state === 'failed' && <FailedIcon />}
									{u.state === 'completed' && <CompletedIcon />}
								</ListItemSecondaryAction>
							</ListItem>
						))}
					</List>
				</Box>
				<DialogActions>
					<Button variant="contained" color="secondary" startIcon={<FolderIcon />} onClick={openFileSelector}>
						Add More Videos
					</Button>
				</DialogActions>
			</Dialog>
		</React.Fragment>
	)
}

function getProgressBar(uploadState, progressPercent) {
	switch (uploadState) {
		case 'queued':
			return <LinearProgress variant="determinate" value={0} />
		case 'uploading':
			return <LinearProgress variant="determinate" value={progressPercent} />
		case 'extracting':
		case 'adding':
		case 'cancelling':
			return <LinearProgress variant="indeterminate" color="secondary" />
		case 'cancelled':
			return <CancelledLinearProgress variant="determinate" value={progressPercent} />
		case 'failed':
			return <FailedLinearProgress variant="determinate" value={100} />
		case 'completed':
			return <CompletedLinearProgress variant="determinate" value={100} />
		default:
			return null
	}
}

function getProgressMessage(uploadState, progressBytes, totalBytes) {
	switch (uploadState) {
		case 'queued':
			return 'Queued'
		case 'extracting':
			return 'Extracting Audio...'
		case 'uploading':
			return `${bytesToMB(progressBytes)} of ${bytesToMB(totalBytes)} MB`
		case 'adding':
			return 'Adding To Batch...'
		case 'cancelling':
			return 'Cancelling...'
		case 'cancelled':
			return 'Cancelled'
		case 'failed':
			return 'Upload failed'
		case 'completed':
			return 'Completed'
		default:
			return ''
	}
}

function bytesToMB(bytes) {
	return (bytes / 1048576).toFixed(2)
}
