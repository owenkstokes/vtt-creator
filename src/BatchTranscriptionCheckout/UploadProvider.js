import React from 'react'
import throttle from 'lodash/throttle'
import {v4 as uuid} from 'uuid'
import PropTypes from 'prop-types'
import EventEmitter from 'events'
import {gql, useApolloClient} from '@apollo/client'
import {uploadFile} from '../services/rest-api.service'
import {handleError} from '../services/error-handler.service'
import {appendNewJob, JobHistoryTable_jobsFragment} from '../account/JobHistoryTable.graphql'
import TaskQueue, {QUEUE_EVENT_DONE, QUEUE_EVENT_CANCELLED, QUEUE_EVENT_ERROR} from '../common/TaskQueue'
import {appendJobToBatch, BatchTranscriptionCart_jobsFragment} from './BatchTranscriptionCart.graphql'

const UploadContext = React.createContext({
	uploadState: {},
	handleAddFiles: () => undefined,
	handleRemoveFile: () => undefined,
	handleUpload: () => undefined,
	handleCancelBatch: () => undefined,
	handleCancelFile: () => undefined,
})

UploadProvider.propTypes = {
	children: PropTypes.node.isRequired,
}

export function UploadProvider({children}) {
	const apolloClient = useApolloClient()

	const uploadQueueRef = React.useRef(new Queue())

	const uploadStateRef = React.useRef({
		uploading: false,
		batches: {},
	})

	const [uploadState, _setUploadState] = React.useState(uploadStateRef.current)

	const setUploadState = React.useCallback(updater => {
		uploadStateRef.current = updater(uploadStateRef.current)
		_setUploadState(uploadStateRef.current)
	}, [])

	React.useEffect(() => {
		const q = uploadQueueRef.current

		const handleUploadDone = () => {
			setUploadState(u => ({...u, uploading: false}))
		}

		const handleUploadStart = () => {
			setUploadState(u => ({...u, uploading: true}))
		}

		q.on('started', handleUploadStart)
		q.on('empty', handleUploadDone)
		return () => {
			q.off('started', handleUploadStart)
			q.off('empty', handleUploadDone)
		}
	}, [setUploadState])

	const setBatchState = React.useCallback(
		(batchId, updater) => {
			const defaultEmptyBatch = {batchId, uploading: false, uploads: []}
			setUploadState(u => ({
				...u,
				batches: {
					...u.batches,
					[batchId]: updater(u.batches[batchId] || defaultEmptyBatch),
				},
			}))
		},
		[setUploadState]
	)

	const handleRemoveFile = React.useCallback(
		(batchId, id) => {
			setBatchState(batchId, b => ({...b, uploads: b.uploads.filter(u => u.id !== id)}))
		},
		[setBatchState]
	)

	const checkBatchDone = React.useCallback(
		batchId => {
			setBatchState(batchId, b => ({
				...b,
				uploading: b.uploads.some(u => ['queued', 'extracting', 'uploading', 'adding'].includes(u.state)),
			}))
		},
		[setBatchState]
	)

	const handleCancelFile = React.useCallback(
		(batchId, id) => {
			setBatchState(batchId, b => ({
				...b,
				uploads: b.uploads.map(u => {
					if (u.id === id && u.state === 'queued') {
						uploadQueueRef.current.removeItemById(id)
						return {...u, state: 'cancelled'}
					} else if (u.id === id && ['extracting', 'uploading'].includes(u.state)) {
						u.uploader.cancel().catch(handleError)
						return {...u, state: 'cancelled'}
					}
					return u
				}),
			}))
			checkBatchDone(batchId)
		},
		[setBatchState, checkBatchDone]
	)

	const handleCancelBatch = React.useCallback(
		batchId => {
			setBatchState(batchId, b => ({
				...b,
				uploads: b.uploads.map(u => {
					if (u.state === 'queued') {
						uploadQueueRef.current.removeItemById(u.id)
						return {...u, state: 'cancelled'}
					} else if (u.state === 'uploading') {
						u.uploader.cancel().catch(handleError)
						return {...u, state: 'cancelled'}
					}
					return u
				}),
			}))
		},
		[setBatchState]
	)

	const getSingleUploadUpdater = React.useCallback(
		(batchId, id) => {
			return update => {
				setBatchState(batchId, b => ({
					...b,
					uploads: b.uploads.map(u => {
						if (u.id === id) return {...u, ...update}
						return u
					}),
				}))
			}
		},
		[setBatchState]
	)

	const handleCreateUploadUrls = React.useCallback(
		async filenames => {
			const {
				data: {createFileUploads},
			} = await apolloClient.mutate({
				mutation: gql`
					mutation getUploadUrl($filenames: [String!]!) {
						createFileUploads(filenames: $filenames) {
							fileUploads {
								id
							}
							uploadUrls
						}
					}
				`,
				variables: {filenames},
			})

			return createFileUploads
		},
		[apolloClient]
	)

	const handleExtractAudio = React.useCallback(
		async inputFileId => {
			const {
				data: {extractAudioFromFile},
			} = await apolloClient.mutate({
				mutation: gql`
					mutation extractAudio($inputFileId: String!) {
						extractAudioFromFile(inputFileId: $inputFileId) {
							audioFile {
								id
							}
						}
					}
				`,
				variables: {inputFileId},
			})

			return extractAudioFromFile.audioFile
		},
		[apolloClient]
	)

	const handleCreateTranscriptionJob = React.useCallback(
		async (batchId, fileUploadId) => {
			const {
				data: {addAudioTranscriptionToBatch},
			} = await apolloClient.mutate({
				mutation: gql`
					mutation addJobToBatch($batchId: String!, $fileUploadId: String!, $languageCode: String!) {
						addAudioTranscriptionToBatch(batchId: $batchId, fileUploadId: $fileUploadId, languageCode: $languageCode) {
							batch {
								id
							}
							job {
								...BatchTranscriptionCart_jobs
								...JobHistoryTable_jobs
							}
						}
					}
					${BatchTranscriptionCart_jobsFragment}
					${JobHistoryTable_jobsFragment}
				`,
				variables: {
					batchId,
					fileUploadId,
					languageCode: 'en-US',
				},
				update(cache, {data: {addAudioTranscriptionToBatch}}) {
					const {batch, job} = addAudioTranscriptionToBatch
					appendJobToBatch(cache, batch.id, job)
					appendNewJob(cache, job)
				},
			})

			return addAudioTranscriptionToBatch
		},
		[apolloClient]
	)

	const handleUpload = React.useCallback(
		batchId => {
			const queuedUploads = uploadStateRef.current.batches[batchId].uploads.reduce((queued, u) => {
				if (u.state === 'queued') queued.push(u)
				return queued
			}, [])

			const filenames = queuedUploads.map(u => u.file.name)

			if (!filenames.length) return

			return handleCreateUploadUrls(filenames)
				.then(({uploadUrls, fileUploads}) => {
					const uploadQueue = queuedUploads.map((upload, i) => {
						const uploadUrl = uploadUrls[i]
						const fileUploadId = fileUploads[i].id

						const updateSingleUpload = getSingleUploadUpdater(upload.batchId, upload.id)

						const handleProgress = throttle(e => {
							updateSingleUpload({loaded: e.loaded, total: e.total})
						}, 500)

						const singleUploadTask = new TaskQueue([
							{
								name: 'Upload Video',
								run: ctx => {
									const uploader = uploadFile(upload.file, uploadUrl, handleProgress)
									return {
										promise: uploader.promise
											.then(() => ctx)
											.catch(e => {
												throw new Error(e.message)
											}),
										cancel: () => uploader.cancel(),
									}
								},
							},
							{
								name: 'Extract Audio',
								run: ctx => {
									updateSingleUpload({state: 'extracting'})
									return {
										promise: handleExtractAudio(fileUploadId)
											.then(audioFile => ({...ctx, audioFileId: audioFile.id}))
											.catch(e => {
												throw new Error(e.message)
											}),
									}
								},
							},
							{
								name: 'Add Transcription',
								run: (ctx, queue) => {
									updateSingleUpload({state: 'adding'})
									queue.disableCancel()
									return {
										promise: handleCreateTranscriptionJob(upload.batchId, ctx.audioFileId)
											.then(({job}) => {
												return {...ctx, job: job}
											})
											.catch(e => {
												throw new Error(e.message)
											})
											.finally(() => queue.enableCancel()),
									}
								},
							},
						])

						return async function startSingleUpload() {
							return new Promise((resolve, reject) => {
								singleUploadTask.once(QUEUE_EVENT_DONE, () => {
									updateSingleUpload({state: 'completed'})
									resolve()
								})
								// cancelled event is required since neither done nor error will fire if cancelled
								singleUploadTask.once(QUEUE_EVENT_CANCELLED, resolve)
								singleUploadTask.once(QUEUE_EVENT_ERROR, reject)

								updateSingleUpload({state: 'uploading', uploader: singleUploadTask})

								singleUploadTask.run()
							})
								.catch(error => {
									handleError(error)
									updateSingleUpload({state: 'failed', error})
								})
								.finally(() => {
									checkBatchDone(batchId)
								})
						}
					})

					setBatchState(batchId, b => ({...b, uploading: true}))
					uploadQueueRef.current.addItems(uploadQueue)
					uploadQueueRef.current.start()
				})
				.catch(error => {
					handleError(error)
					setUploadState(u => ({...u, error}))
				})
		},
		[
			checkBatchDone,
			getSingleUploadUpdater,
			handleCreateTranscriptionJob,
			handleCreateUploadUrls,
			handleExtractAudio,
			setBatchState,
			setUploadState,
		]
	)

	const handleAddFiles = React.useCallback(
		(batchId, files) => {
			const newUploads = files.map(file => ({
				id: uuid(),
				batchId,
				state: 'queued',
				file,
				loaded: 0,
				total: file.size || 0,
				error: null,
			}))

			setBatchState(batchId, b => ({...b, uploads: [...b.uploads, ...newUploads]}))

			handleUpload(batchId)
		},
		[handleUpload, setBatchState]
	)

	return (
		<UploadContext.Provider
			value={{
				uploadState,
				handleAddFiles,
				handleRemoveFile,
				handleUpload,
				handleCancelBatch,
				handleCancelFile,
			}}>
			{children}
		</UploadContext.Provider>
	)
}

export function useUpload() {
	return React.useContext(UploadContext)
}

class Queue extends EventEmitter {
	constructor(concurrency = 3) {
		super()
		this.queue = []
		this.numInProgress = 0
		this.concurrency = concurrency
		this.running = false
	}

	start() {
		if (!this.running) this.emit('started')

		this.running = true

		if (!this.queue.length && !this.numInProgress) {
			this.running = false
			return this.emit('empty')
		}

		while (this.queue.length && this.numInProgress < this.concurrency) {
			this.numInProgress++
			const item = this.queue.shift()
			// eslint-disable-next-line no-loop-func
			item?.().finally(() => {
				this.numInProgress--
				this.start()
			})
		}
	}

	addItems(items) {
		this.queue.push(...items)
	}

	removeItemById(id) {
		this.queue = this.queue.filter(item => item.id !== id)
	}
}
