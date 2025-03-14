import type {
	IExecuteFunctions,
	// IHookFunctions,
	// IWebhookFunctions,
	// IDataObject,
	INodeType,
	INodeTypeDescription,
	// IWebhookResponseData,
	INodeExecutionData,
	ILoadOptionsFunctions,
	INodePropertyOptions,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

export class SymbiosikaChatWithAssistant implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Symbiosika Assistant Chat',
		name: 'symbiosikaChatWithAssistant',
		icon: 'file:symbiosika.svg',
		group: ['transform'],
		version: 1,
		description: 'Chat with a Symbiosika Assistant',
		defaults: {
			name: 'Symbiosika Assistant Chat',
		},
		inputs: ['main'] as any,
		outputs: ['main'] as any,
		credentials: [
			{
				name: 'symbiosikaChatApi',
				required: true,
			},
		],
		properties: [
			// Chat Properties
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Chat with Assistant',
						value: 'chat',
						description: 'Send a message to chat with the assistant',
						action: 'Chat with an assistant',
					},
					{
						name: 'Get Available Assistants',
						value: 'getAssistants',
						description: 'Get a list of available assistants',
						action: 'Get available assistants',
					},
					{
						name: 'Reset Chat',
						value: 'resetChat',
						description: 'Reset an existing chat conversation',
						action: 'Reset a chat conversation',
					},
				],
				default: 'chat',
			},
			// Input field for chat
			{
				displayName: 'User Input',
				name: 'userInput',
				type: 'string',
				default: '',
				description: 'The user message to send to the assistant',
				displayOptions: {
					show: {
						operation: ['chat'],
					},
				},
				required: true,
			},
			{
				displayName: 'Use Existing Chat ID',
				name: 'useExistingChatId',
				type: 'boolean',
				default: false,
				description: 'Whether to use an existing chat ID for continuing a conversation',
				displayOptions: {
					show: {
						operation: ['chat'],
					},
				},
			},
			{
				displayName: 'Chat ID',
				name: 'chatId',
				type: 'string',
				default: '',
				description: 'The ID of an existing chat to continue',
				displayOptions: {
					show: {
						useExistingChatId: [true],
						operation: ['chat'],
					},
				},
			},
			{
				displayName: 'Use Specific Assistant',
				name: 'useSpecificAssistant',
				type: 'boolean',
				default: false,
				description: 'Whether to use a specific assistant template',
				displayOptions: {
					show: {
						operation: ['chat'],
					},
				},
			},
			{
				displayName: 'Assistant Name or ID',
				name: 'assistantId',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getAssistants',
				},
				default: '',
				description:
					'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
				displayOptions: {
					show: {
						useSpecificAssistant: [true],
						operation: ['chat'],
					},
				},
			},
			// Reset Chat Properties
			{
				displayName: 'Chat ID',
				name: 'resetChatId',
				type: 'string',
				default: '',
				description: 'The ID of the chat to reset',
				displayOptions: {
					show: {
						operation: ['resetChat'],
					},
				},
				required: true,
			},
		],
	};

	methods = {
		loadOptions: {
			async getAssistants(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const credentials = await this.getCredentials('symbiosikaChatApi');
				const endpoint = `${credentials.apiUrl}/api/v1/organisation/${credentials.organisationId}/ai/templates`;

				try {
					const response = await this.helpers.request({
						method: 'GET',
						uri: endpoint,
						json: true,
						headers: {
							Authorization: `Bearer ${credentials.apiKey}`,
							'X-Organisation-ID': credentials.organisationId,
						},
					});

					if (!Array.isArray(response)) {
						throw new NodeOperationError(this.getNode(), 'Invalid response format');
					}

					return response.map((template) => ({
						name: `[${template.category || 'General'}] ${template.label || template.name}`,
						value: template.id,
					}));
				} catch (error) {
					return [{ name: 'Error Loading Assistants', value: '' }];
				}
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const operation = this.getNodeParameter('operation', 0) as string;
		const credentials = await this.getCredentials('symbiosikaChatApi');

		if (operation === 'getAssistants') {
			// Get available assistants
			try {
				const endpoint = `${credentials.apiUrl}/api/v1/organisation/${credentials.organisationId}/ai/templates`;

				const response = await this.helpers.request({
					method: 'GET',
					uri: endpoint,
					json: true,
					headers: {
						Authorization: `Bearer ${credentials.apiKey}`,
						'X-Organisation-ID': credentials.organisationId,
					},
				});

				returnData.push({
					json: {
						assistants: response,
					},
				});
			} catch (error) {
				throw new NodeOperationError(
					this.getNode(),
					`Failed to fetch assistants: ${error.message}`,
				);
			}
		} else if (operation === 'chat') {
			for (let i = 0; i < items.length; i++) {
				try {
					// Get user input
					let userInput = this.getNodeParameter('userInput', i) as string;

					if (!userInput) {
						throw new NodeOperationError(this.getNode(), 'No user input provided', {
							itemIndex: i,
						});
					}

					// Check if we should use an existing chat ID
					const useExistingChatId = this.getNodeParameter('useExistingChatId', i, false) as boolean;
					let existingChatId: string | undefined;

					if (useExistingChatId) {
						// Get chat ID from parameter or from input
						existingChatId = this.getNodeParameter('chatId', i, '') as string;

						// If no explicit chatId is provided, check if it's in the input data
						if (!existingChatId && items[i].json.chatId) {
							existingChatId = items[i].json.chatId as string;
						}
					}

					// Build API request
					const endpoint = `${credentials.apiUrl}/api/v1/organisation/${credentials.organisationId}/ai/chat-with-template`;
					const requestBody: any = {
						userMessage: userInput,
						variables: {
							user_input: userInput,
						},
						meta: {
							organisationId: credentials.organisationId,
						},
					};

					// Add existing chatId if available
					if (existingChatId) {
						requestBody.chatId = existingChatId;
					}

					// Check if we should use a specific assistant
					const useSpecificAssistant = this.getNodeParameter(
						'useSpecificAssistant',
						i,
						false,
					) as boolean;
					if (useSpecificAssistant) {
						const assistantId = this.getNodeParameter('assistantId', i) as string;
						if (assistantId) {
							requestBody.initiateTemplate = {
								promptId: assistantId,
							};
						}
					}

					const response = await this.helpers.request({
						method: 'POST',
						uri: endpoint,
						json: true,
						headers: {
							Authorization: `Bearer ${credentials.apiKey}`,
							'X-Organisation-ID': credentials.organisationId,
						},
						body: requestBody,
					});

					// Extract message content from response
					if (response && response.message && response.message.content) {
						const assistantMessage = response.message.content;

						// Create output item with the assistant's response
						const newItem: INodeExecutionData = {
							json: {
								assistantMessage,
								chatId: response.chatId,
								finished: response.finished,
								render: response.render,
								sessionId: items[i].json.sessionId, // Pass through any sessionId
							},
						};

						returnData.push(newItem);
					} else {
						throw new NodeOperationError(this.getNode(), 'Invalid response from Symbiosika API', {
							itemIndex: i,
						});
					}
				} catch (error) {
					if (this.continueOnFail()) {
						returnData.push({
							json: {
								error: error.message,
							},
						});
						continue;
					}
					throw error;
				}
			}
		} else if (operation === 'resetChat') {
			for (let i = 0; i < items.length; i++) {
				try {
					const resetChatId = this.getNodeParameter('resetChatId', i, '') as string;

					if (!resetChatId) {
						throw new NodeOperationError(this.getNode(), 'No chat ID provided for reset', {
							itemIndex: i,
						});
					}

					const endpoint = `${credentials.apiUrl}/api/v1/organisation/${credentials.organisationId}/ai/reset-chat`;
					const requestBody: any = {
						chatId: resetChatId,
					};

					const response = await this.helpers.request({
						method: 'POST',
						uri: endpoint,
						json: true,
						headers: {
							Authorization: `Bearer ${credentials.apiKey}`,
							'X-Organisation-ID': credentials.organisationId,
						},
						body: requestBody,
					});

					if (response && response.message && response.message.content) {
						const resetMessage = response.message.content;

						const newItem: INodeExecutionData = {
							json: {
								resetMessage,
								chatId: resetChatId,
								finished: response.finished,
								render: response.render,
								sessionId: items[i].json.sessionId,
							},
						};

						returnData.push(newItem);
					} else {
						throw new NodeOperationError(this.getNode(), 'Invalid response from Symbiosika API', {
							itemIndex: i,
						});
					}
				} catch (error) {
					if (this.continueOnFail()) {
						returnData.push({
							json: {
								error: error.message,
							},
						});
						continue;
					}
					throw error;
				}
			}
		} else {
			throw new NodeOperationError(this.getNode(), `Operation ${operation} is not supported`);
		}

		return [returnData];
	}
}
