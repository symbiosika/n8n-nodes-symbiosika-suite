import type {
	IExecuteFunctions,
	INodeType,
	INodeTypeDescription,
	INodeExecutionData,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

export class SymbiosikaChatHistory implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Symbiosika Chat History',
		name: 'symbiosikaChatHistory',
		icon: 'file:symbiosika.svg',
		group: ['transform'],
		version: 1,
		description: 'Retrieve chat history from Symbiosika',
		defaults: {
			name: 'Symbiosika Chat History',
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
			{
				displayName: 'Chat ID Source',
				name: 'chatIdSource',
				type: 'options',
				options: [
					{
						name: 'Input Field',
						value: 'inputField',
						description: 'Take the chat ID from the input data',
					},
					{
						name: 'Manual Entry',
						value: 'manual',
						description: 'Manually enter a chat ID',
					},
				],
				default: 'inputField',
				description: 'Where to get the chat ID from',
			},
			{
				displayName: 'Chat ID',
				name: 'chatId',
				type: 'string',
				default: '',
				description: 'The ID of the chat to retrieve history for',
				displayOptions: {
					show: {
						chatIdSource: ['manual'],
					},
				},
				required: true,
			},
			{
				displayName: 'Chat ID Field',
				name: 'chatIdField',
				type: 'string',
				default: 'chatId',
				description: 'The field in the input data that contains the chat ID',
				displayOptions: {
					show: {
						chatIdSource: ['inputField'],
					},
				},
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const credentials = await this.getCredentials('symbiosikaChatApi');

		for (let i = 0; i < items.length; i++) {
			try {
				// Get chat ID based on selected source
				const chatIdSource = this.getNodeParameter('chatIdSource', i) as string;
				let chatId: string;

				if (chatIdSource === 'manual') {
					chatId = this.getNodeParameter('chatId', i) as string;
				} else {
					const chatIdField = this.getNodeParameter('chatIdField', i, 'chatId') as string;
					chatId = items[i].json[chatIdField] as string;
				}

				if (!chatId) {
					throw new NodeOperationError(this.getNode(), 'No chat ID provided', { itemIndex: i });
				}

				// Build API request to get chat history
				const endpoint = `${credentials.apiUrl}/api/v1/organisation/${credentials.organisationId}/ai/chat/history/${chatId}`;

				const response = await this.helpers.request({
					method: 'GET',
					uri: endpoint,
					json: true,
					headers: {
						Authorization: `Bearer ${credentials.apiKey}`,
						'X-Organisation-ID': credentials.organisationId,
					},
				});

				if (response) {
					// Create output item with the chat history
					const newItem: INodeExecutionData = {
						json: {
							...items[i].json,
							chatHistoryResponse: response,
						},
					};

					returnData.push(newItem);
				} else {
					throw new NodeOperationError(
						this.getNode(),
						'Invalid response from Symbiosika API for chat ID: ' + chatId,
						{
							itemIndex: i,
						},
					);
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							...items[i].json,
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
