import type {
	IExecuteFunctions,
	// IHookFunctions,
	// IWebhookFunctions,
	// IDataObject,
	INodeType,
	INodeTypeDescription,
	// IWebhookResponseData,
	INodeExecutionData,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

export class SymbiosikaChatWithAssistant implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Symbiosika Assistant Chat',
		name: 'SymbiosikaChatWithAssistant',
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
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const operation = this.getNodeParameter('operation', 0) as string;

		if (operation !== 'chat') {
			throw new NodeOperationError(this.getNode(), `Operation ${operation} is not supported`);
		}

		const credentials = await this.getCredentials('symbiosikaChatApi');

		for (let i = 0; i < items.length; i++) {
			try {
				// Get user input either from parameter or specified field
				let userInput = this.getNodeParameter('userInput', i) as string;

				if (!userInput) {
					throw new NodeOperationError(this.getNode(), 'No user input provided', { itemIndex: i });
				}

				// Build API request
				const endpoint = `${credentials.apiUrl}/api/v1/organisation/${credentials.organisationId}/ai/chat-with-template`;
				const response = await this.helpers.request({
					method: 'POST',
					uri: endpoint,
					json: true,
					headers: {
						Authorization: `Bearer ${credentials.apiKey}`,
						'X-Organisation-ID': credentials.organisationId,
					},
					body: {
						userMessage: userInput,
						variables: {
							user_input: userInput,
						},
						meta: {
							organisationId: credentials.organisationId,
						},
					},
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

		return [returnData];
	}
}
