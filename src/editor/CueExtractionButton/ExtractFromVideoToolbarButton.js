import React from 'react'
import PropTypes from 'prop-types'
import Tooltip from '@material-ui/core/Tooltip'
import CaptionsIcon from '@material-ui/icons/ClosedCaption'
import {useVideoFile, Button} from '../../common'
import {useExtractFromVideo} from './ExtractFromVideoContext'

ExtractFromVideoToolbarButton.propTypes = {
	className: PropTypes.any,
}

export default function ExtractFromVideoToolbarButton(props) {
	const {videoFile} = useVideoFile()
	const {handleCueExtractionDialogOpen, loading} = useExtractFromVideo()

	const tooltipText = getTooltipText(loading, videoFile)

	if (tooltipText) {
		// span needed here because tooltips don't activate on disabled elements: https://material-ui.com/components/tooltips/#disabled-elements
		return (
			<Tooltip title={tooltipText}>
				<span className={props.className}>
					<Button {...props} disabled>
						<CaptionsIcon />
					</Button>
				</span>
			</Tooltip>
		)
	}

	return (
		<Button {...props} name="extract from video toolbar button" onClick={handleCueExtractionDialogOpen}>
			<Tooltip title="Extract captions from video">
				<CaptionsIcon />
			</Tooltip>
		</Button>
	)
}

function getTooltipText(loading, videoFile) {
	if (loading) return 'Please wait...'
	if (!videoFile) return 'Select a video in the pane to the left, then you can automatically extract captions.'
}
