import {ApolloClient, ApolloLink, InMemoryCache, from, Observable} from '@apollo/client'
import {v4 as uuid} from 'uuid'
import EventEmitter from 'events'
import chai from 'chai'
import spies from 'chai-spies'
import audioFileUrl from './test_tone.wav'
import {
	EVENT_CANCEL_DISABLED,
	EVENT_ERROR,
	EVENT_JOB_STATE,
	JOB_STATE_EXTRACTING,
	JOB_STATE_TRANSCRIBING,
	JOB_STATE_UPLOADING,
	getJobRunner,
	EVENT_DONE,
	EVENT_CANCELLING,
	EVENT_CANCELLED,
} from './job-runner'

chai.use(spies)

describe('JobRunner', function() {
	describe('when a job is started', function() {
		beforeEach(function(done) {
			this.apolloEvents = new EventEmitter()
			const dummyLink = new ApolloLink(operation => {
				this.lastOp = operation
				return new Observable(observer => {
					this.linkObserver = observer
					this.apolloEvents.emit('op', operation, observer)
				})
			})

			window.gtag = chai.spy()
			const apolloClient = new ApolloClient({link: from([dummyLink]), cache: new InMemoryCache()})
			this.uploadFileSpy = chai.spy(() => ({
				promise: Promise.resolve(),
				cancel: () => Promise.resolve(),
			}))
			this.runner = getJobRunner(apolloClient, this.uploadFileSpy)

			this.expectedLanguage = 'en-US'
			this.jobStateEvents = []
			this.cancelDisabledEvents = []
			this.errorEvents = []
			this.doneEvents = []
			this.cancellingEvents = 0
			this.cancelledEvents = 0
			this.runner.on(EVENT_JOB_STATE, state => {
				this.jobStateEvents.push(state)
			})
			this.runner.on(EVENT_CANCEL_DISABLED, disabled => {
				this.cancelDisabledEvents.push(disabled)
			})
			this.runner.on(EVENT_ERROR, err => {
				this.errorEvents.push(err)
			})
			this.runner.on(EVENT_DONE, result => {
				this.doneEvents.push(result)
			})
			this.runner.on(EVENT_CANCELLING, () => {
				this.cancellingEvents++
			})
			this.runner.on(EVENT_CANCELLED, () => {
				this.cancelledEvents++
			})
			// start assertions at the first graphql call, which should be to get an upload url
			this.runner.once(EVENT_ERROR, done)
			this.apolloEvents.once('op', () => {
				this.runner.off(EVENT_ERROR, done)
				done()
			})
			// actually an audio file, but audiocontext doesn't care
			getTestFile()
				.then(videoFile => {
					this.jobPromise = this.runner.run({
						videoFile,
						isPhoneCall: false,
						languageCode: this.expectedLanguage,
						pollInterval: 10,
					})
				})
				.catch(done)
		})

		it(`the job is immediately marked 'in progress'`, function() {
			chai.expect(this.runner.inProgress).to.equal(true)
		})

		it('one event is fired', function() {
			chai.expect(this.jobStateEvents).to.have.length(1)
		})

		it(`an 'uploading' event is fired`, function() {
			chai.expect(this.jobStateEvents[0]).to.equal(JOB_STATE_UPLOADING)
		})

		it(`cancelling the job should be allowed`, function() {
			chai.expect(this.runner.cancelDisabled).to.equal(false)
			chai.expect(this.cancelDisabledEvents).to.have.length(0)
		})

		it(`the pending operation should be to retrieve an upload url`, function() {
			chai.expect(this.lastOp.operationName).to.equal('getUploadUrl')
		})

		it(`no errors are emitted`, function() {
			chai.expect(this.errorEvents).to.have.length(0)
		})

		it('no done events are emitted', function() {
			chai.expect(this.doneEvents).to.have.length(0)
		})

		describe('then, if an upload url is successfully retrieved', function() {
			beforeEach(function(done) {
				this.expectedFileId = uuid()
				this.expectedUploadUrl = uuid()
				// start assertions at the next graphql call, which should be to start the transcription
				this.apolloEvents.once('op', () => done())
				this.linkObserver.next({
					data: {createFileUpload: {fileUploadId: this.expectedFileId, uploadUrl: this.expectedUploadUrl}},
				})
				this.linkObserver.complete()
			})

			it(`the job is still 'in progress'`, function() {
				chai.expect(this.runner.inProgress).to.equal(true)
			})

			it(`an upload has been started to the correct endpoint`, function() {
				chai.expect(this.uploadFileSpy).to.have.been.called.with(this.expectedUploadUrl)
			})

			it('a second event has been fired', function() {
				chai.expect(this.jobStateEvents).to.have.length(2)
			})

			it(`the second event should be the extracting event`, function() {
				chai.expect(this.jobStateEvents[1]).to.equal(JOB_STATE_EXTRACTING)
			})

			it(`cancelling the job should be allowed`, function() {
				chai.expect(this.runner.cancelDisabled).to.equal(false)
				chai.expect(this.cancelDisabledEvents).to.have.length(0)
			})

			it(`the pending operation should be to extract the audio`, function() {
				chai.expect(this.lastOp.operationName).to.equal('extractAudio')
			})

			it(`the extraction should run against the uploaded file`, function() {
				chai.expect(this.lastOp.variables.inputFileId).to.equal(this.expectedFileId)
			})

			it(`no errors are emitted`, function() {
				chai.expect(this.errorEvents).to.have.length(0)
			})

			it('no done events are emitted', function() {
				chai.expect(this.doneEvents).to.have.length(0)
			})

			describe('then, if extraction is successful', function() {
				beforeEach(function(done) {
					this.expectedFileId = uuid()
					// start assertions at the next graphql call, which should be to start the transcription
					this.apolloEvents.once('op', () => done())
					this.linkObserver.next({
						data: {extractAudioFromFile: {audioFile: {id: this.expectedFileId}}},
					})
					this.linkObserver.complete()
				})

				it(`the job is still 'in progress'`, function() {
					chai.expect(this.runner.inProgress).to.equal(true)
				})

				it('a third event has been fired', function() {
					chai.expect(this.jobStateEvents).to.have.length(3)
				})

				it(`the third event should be the transcribing event`, function() {
					chai.expect(this.jobStateEvents[2]).to.equal(JOB_STATE_TRANSCRIBING)
				})

				it(`cancelling the job should be disabled`, function() {
					chai.expect(this.runner.cancelDisabled).to.equal(true)
					chai.expect(this.cancelDisabledEvents).to.have.length(1)
					chai.expect(this.cancelDisabledEvents[0]).to.equal(true)
				})

				it(`the pending operation should be to start a transcription job`, function() {
					chai.expect(this.lastOp.operationName).to.equal('initTranscription')
				})

				it(`the transcription job should run against the converted audio file`, function() {
					chai.expect(this.lastOp.variables.inputFileId).to.equal(this.expectedFileId)
				})

				it(`the transcription job should run with the specified language`, function() {
					chai.expect(this.lastOp.variables.languageCode).to.equal(this.expectedLanguage)
				})

				it(`no errors are emitted`, function() {
					chai.expect(this.errorEvents).to.have.length(0)
				})

				it('no done events are emitted', function() {
					chai.expect(this.doneEvents).to.have.length(0)
				})

				describe('then, if a transcription is successfully started', function() {
					beforeEach(function(done) {
						this.expectedJobId = uuid()
						// start assertions at the next graphql call, which should be to poll the transcription
						this.apolloEvents.once('op', () => done())
						this.linkObserver.next({data: {beginTranscription: {job: {id: this.expectedJobId}}}})
						this.linkObserver.complete()
					})

					it(`no errors are emitted`, function() {
						chai.expect(this.errorEvents).to.have.length(0)
					})

					it('no done events are emitted', function() {
						chai.expect(this.doneEvents).to.have.length(0)
					})

					it(`the job is still 'in progress'`, function() {
						chai.expect(this.runner.inProgress).to.equal(true)
					})

					it(`the pending operation should be to poll the transcription job`, function() {
						chai.expect(this.lastOp.operationName).to.equal('getTranscriptionJob')
					})

					describe('then, if the first check is successful, but the job is not yet complete', function() {
						beforeEach(function(done) {
							// start assertions at the next graphql call, which should be to poll the transcription again
							this.apolloEvents.once('op', () => done())
							this.linkObserver.next({data: {transcriptionJob: {state: 'pending'}}})
							this.linkObserver.complete()
						})

						it(`no errors are emitted`, function() {
							chai.expect(this.errorEvents).to.have.length(0)
						})

						it('no done events are emitted', function() {
							chai.expect(this.doneEvents).to.have.length(0)
						})

						it(`the job is still 'in progress'`, function() {
							chai.expect(this.runner.inProgress).to.equal(true)
						})

						it(`the pending operation should be to poll the transcription job again`, function() {
							chai.expect(this.lastOp.operationName).to.equal('getTranscriptionJob')
						})

						describe('when the second check is successful and the job is complete', function() {
							beforeEach(async function() {
								this.expectedTranscript = {words: []}
								this.linkObserver.next({
									data: {transcriptionJob: {state: 'success', transcript: this.expectedTranscript}},
								})
								this.linkObserver.complete()

								await this.jobPromise
							})

							it(`no errors are emitted`, function() {
								chai.expect(this.errorEvents).to.have.length(0)
							})

							it(`the job is no longer 'in progress'`, function() {
								chai.expect(this.runner.inProgress).to.equal(false)
							})

							it(`the transcript should be returned via the done event`, function() {
								chai.expect(this.doneEvents).to.have.length(1)
								chai.expect(this.expectedTranscript).to.equal(this.doneEvents[0].transcript)
							})
						})
					})

					describe('then, if the first check is successful, but the job is failed from the backend', function() {
						beforeEach(function() {
							// the job should fail here, so we shouldn't reach the next graphql call, but rather end the job
							this.linkObserver.next({data: {transcriptionJob: {state: 'error'}}})
							this.linkObserver.complete()
							return this.jobPromise
						})

						it(`the job is no longer 'in progress'`, function() {
							chai.expect(this.runner.inProgress).to.equal(false)
						})

						it(`an error is emitted`, function() {
							chai.expect(this.errorEvents).to.have.length(1)
						})

						it(`no other job state events are emitted`, function() {
							chai.expect(this.jobStateEvents).to.have.length(3)
							chai.expect(this.jobStateEvents[2]).to.equal(JOB_STATE_TRANSCRIBING)
						})
					})

					describe('then, if an error occurs during the first check request', function() {
						beforeEach(function() {
							this.linkObserver.error(new Error('error polling transcription'))
							return this.jobPromise
						})

						it(`the job is no longer 'in progress'`, function() {
							chai.expect(this.runner.inProgress).to.equal(false)
						})

						it(`an error is emitted`, function() {
							chai.expect(this.errorEvents).to.have.length(1)
						})

						it(`no other job state events are emitted`, function() {
							chai.expect(this.jobStateEvents).to.have.length(3)
							chai.expect(this.jobStateEvents[2]).to.equal(JOB_STATE_TRANSCRIBING)
						})
					})

					describe('then, if the job is cancelled during polling', function() {
						beforeEach(function() {
							// when we call runner.cancel(), we'll launch a new apollo operation, and overwrite the observer we had
							//   for the transcription call. lets cache the observer we have now so we don't lose it
							const getTransJobObserver = this.linkObserver

							this.cancelPromise = this.runner.cancel()
							getTransJobObserver.next({data: {transcriptionJob: {id: 'id', state: 'pending'}}})
							getTransJobObserver.complete()
							return this.jobPromise
						})

						it(`the job is no longer 'in progress'`, function() {
							// TODO: it may make sense to keep the job in progress until the cancellation is fully complete
							chai.expect(this.runner.inProgress).to.equal(false)
						})

						it(`no error is emitted`, function() {
							chai.expect(this.errorEvents).to.have.length(0)
						})

						it('no done events are emitted', function() {
							chai.expect(this.doneEvents).to.have.length(0)
						})

						it('the cancelling event is emitted', function() {
							chai.expect(this.cancellingEvents).to.equal(1)
						})

						it(`no other job state events are emitted`, function() {
							chai.expect(this.jobStateEvents).to.have.length(3)
						})

						it(`the pending operation should be to cancel the transcription job`, function() {
							chai.expect(this.lastOp.operationName).to.equal('cancelTranscription')
						})

						describe('then, when the cancellation completes', function() {
							beforeEach(function() {
								this.linkObserver.next({data: {transcriptionJob: {id: 'id', state: 'pending'}}})
								this.linkObserver.complete()
								return this.cancelPromise
							})

							it(`the job is still not 'in progress'`, function() {
								chai.expect(this.runner.inProgress).to.equal(false)
							})

							it(`no error is emitted`, function() {
								chai.expect(this.errorEvents).to.have.length(0)
							})

							it('no done events are emitted', function() {
								chai.expect(this.doneEvents).to.have.length(0)
							})

							it('the cancelled event is emitted', function() {
								chai.expect(this.cancelledEvents).to.equal(1)
							})

							it('no additional cancelling events are emitted', function() {
								chai.expect(this.cancellingEvents).to.equal(1)
							})

							it(`no additional job state events are emitted`, function() {
								chai.expect(this.jobStateEvents).to.have.length(3)
							})
						})
					})
				})

				describe('then, if an error occurs during transcription init', function() {
					beforeEach(function() {
						this.linkObserver.error(new Error('error starting transcription'))
						return this.jobPromise
					})

					it(`the job is no longer 'in progress'`, function() {
						chai.expect(this.runner.inProgress).to.equal(false)
					})

					it(`an error is emitted`, function() {
						chai.expect(this.errorEvents).to.have.length(1)
					})

					it(`no other job state events are emitted`, function() {
						chai.expect(this.jobStateEvents).to.have.length(3)
						chai.expect(this.jobStateEvents[2]).to.equal(JOB_STATE_TRANSCRIBING)
					})

					it(`the next graphql call is not attempted (the most recent call is still initTranscription)`, function() {
						chai.expect(this.lastOp.operationName).to.equal('initTranscription')
					})
				})

				describe('then, if a cancellation attempt is made during transcription init', function() {
					beforeEach(function(done) {
						this.runner.cancel()
						// cancellation should be blocked here, so we should proceed as normal
						this.apolloEvents.once('op', () => done())
						this.linkObserver.next({data: {beginTranscription: {job: {id: this.expectedJobId}}}})
						this.linkObserver.complete()
					})

					it(`the job is still 'in progress'`, function() {
						chai.expect(this.runner.inProgress).to.equal(true)
					})

					it(`no error is emitted`, function() {
						chai.expect(this.errorEvents).to.have.length(0)
					})

					it('no done events are emitted', function() {
						chai.expect(this.doneEvents).to.have.length(0)
					})

					it(`no cancellation events are emitted`, function() {
						chai.expect(this.cancellingEvents).to.equal(0)
						chai.expect(this.cancelledEvents).to.equal(0)
					})

					it(`no other job state events are emitted`, function() {
						chai.expect(this.jobStateEvents).to.have.length(3)
						chai.expect(this.jobStateEvents[2]).to.equal(JOB_STATE_TRANSCRIBING)
					})

					it(`the pending operation should be to poll the transcription job`, function() {
						chai.expect(this.lastOp.operationName).to.equal('getTranscriptionJob')
					})
				})
			})

			describe('then, if an error occurs during audio extraction', function() {
				beforeEach(function() {
					this.linkObserver.error(new Error('error extracting audio'))
					return this.jobPromise
				})

				it(`the job is no longer 'in progress'`, function() {
					chai.expect(this.runner.inProgress).to.equal(false)
				})

				it(`an error is emitted`, function() {
					chai.expect(this.errorEvents).to.have.length(1)
				})

				it(`no other job state events are emitted`, function() {
					chai.expect(this.jobStateEvents).to.have.length(2)
					chai.expect(this.jobStateEvents[1]).to.equal(JOB_STATE_EXTRACTING)
				})

				it(`the next graphql call is not attempted (the most recent call is still extractAudio)`, function() {
					chai.expect(this.lastOp.operationName).to.equal('extractAudio')
				})
			})

			describe('then, if the job is cancelled during audio extraction', function() {
				beforeEach(function() {
					this.runner.cancel()
					this.expectedFileId = uuid()
					// in this case, since we cancelled, we never will get the next graphql call
					this.linkObserver.next({
						data: {extractAudioFromFile: {audioFile: {id: this.expectedFileId}}},
					})
					this.linkObserver.complete()
					return this.jobPromise
				})

				it(`the job is no longer 'in progress'`, function() {
					chai.expect(this.runner.inProgress).to.equal(false)
				})

				it(`no error is emitted`, function() {
					chai.expect(this.errorEvents).to.have.length(0)
				})

				it('no done events are emitted', function() {
					chai.expect(this.doneEvents).to.have.length(0)
				})

				it('the cancelling event is emitted', function() {
					chai.expect(this.cancellingEvents).to.equal(1)
				})

				it('the cancelled event is emitted', function() {
					chai.expect(this.cancelledEvents).to.equal(1)
				})

				it(`no additional job state events are emitted`, function() {
					chai.expect(this.jobStateEvents).to.have.length(2)
				})
			})
		})

		describe('then an upload url is not successfully retrieved', function() {
			beforeEach(function() {
				this.linkObserver.error(new Error('error getting upload url'))
				return this.jobPromise
			})

			it(`the job is no longer 'in progress'`, function() {
				chai.expect(this.runner.inProgress).to.equal(false)
			})

			it(`an error is emitted`, function() {
				chai.expect(this.errorEvents).to.have.length(1)
			})

			it(`the next graphql call is not attempted (the most recent call is still this one)`, function() {
				chai.expect(this.lastOp.operationName).to.equal('getUploadUrl')
			})
		})

		describe('then, when the job is cancelled during upload url retrieval', function() {
			beforeEach(function() {
				this.runner.cancel()
				this.expectedFileId = uuid()
				this.expectedUploadUrl = uuid()
				// in this case, since we cancelled, we never will get the next graphql call
				this.linkObserver.next({
					data: {createFileUpload: {fileUploadId: this.expectedFileId, uploadUrl: this.expectedUploadUrl}},
				})
				this.linkObserver.complete()
				return this.jobPromise
			})

			it(`the job is no longer 'in progress'`, function() {
				chai.expect(this.runner.inProgress).to.equal(false)
			})

			it(`no error is emitted`, function() {
				chai.expect(this.errorEvents).to.have.length(0)
			})

			it('no done events are emitted', function() {
				chai.expect(this.doneEvents).to.have.length(0)
			})

			it('the cancelling event is emitted', function() {
				chai.expect(this.cancellingEvents).to.equal(1)
			})

			it('the cancelled event is emitted', function() {
				chai.expect(this.cancelledEvents).to.equal(1)
			})

			it(`no additional job state events are emitted`, function() {
				chai.expect(this.jobStateEvents).to.have.length(1)
			})
		})
	})
})

function getTestFile() {
	return new Promise(resolve => {
		const request = new XMLHttpRequest()
		request.open('GET', audioFileUrl, true)
		request.responseType = 'blob'
		request.onload = function() {
			request.response.name = 'test_file.wav'
			resolve(request.response)
		}
		request.send()
	})
}
