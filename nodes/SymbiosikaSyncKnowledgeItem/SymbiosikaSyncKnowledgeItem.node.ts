import type {
	IExecuteFunctions,
	INodeType,
	INodeTypeDescription,
	INodeExecutionData,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

export class SymbiosikaSyncKnowledgeItem implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Symbiosika Sync Knowledge Item',
		name: 'symbiosikaSyncKnowledgeItem',
		icon: 'file:symbiosika.svg',
		group: ['transform'],
		version: 1,
		description: 'Sync a knowledge item with a Symbiosika Assistant',
		defaults: {
			name: 'Symbiosika Sync Knowledge Item',
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
						name: 'Sync Knowledge File',
						value: 'syncKnowledgeItem',
						description: 'Sync a knowledge item with a Symbiosika Assistant',
						action: 'Sync a knowledge item',
					},
					{
						name: 'Sync Knowledge Entry By Text Only',
						value: 'syncKnowledgeEntryByText',
						description: 'Sync a knowledge entry by text only',
						action: 'Sync a knowledge entry by text only',
					},
					{
						name: 'Check Knowledge Item If It Should Be Synced',
						value: 'checkKnowledgeItem',
						description: 'Check if a knowledge item exists and if it should be synced',
						action: 'Check if a knowledge item exists and if it should be synced',
					},
				],
				default: 'syncKnowledgeItem',
			},
			// Input field for chat
			{
				displayName: 'Sync-ID (External)',
				name: 'externalId',
				type: 'string',
				default: '',
				description: 'The sync-ID of the knowledge item to sync',
				displayOptions: {
					show: {
						operation: ['syncKnowledgeItem', 'checkKnowledgeItem', 'syncKnowledgeEntryByText'],
					},
				},
				required: true,
			},
			{
				displayName: 'Last Change Of The Item',
				name: 'lastChange',
				type: 'string',
				default: '',
				description: 'The last changed date of the knowledge item',
				displayOptions: {
					show: {
						operation: ['syncKnowledgeItem', 'checkKnowledgeItem', 'syncKnowledgeEntryByText'],
					},
				},
			},
			{
				displayName: 'Binary Property',
				name: 'binaryPropertyName',
				type: 'string',
				default: 'data',
				required: true,
				displayOptions: {
					show: {
						operation: ['syncKnowledgeItem'],
					},
				},
				description: 'Name of the property that contains the binary data',
			},
			{
				displayName: 'Knowledge Text',
				name: 'knowledgeText',
				type: 'string',
				default: '',
				description: 'The knowledge text to sync',
				displayOptions: {
					show: {
						operation: ['syncKnowledgeEntryByText'],
					},
				},
				required: true,
			},
			{
				displayName: 'Knowledge Title',
				name: 'knowledgeTitle',
				type: 'string',
				default: '',
				description: 'The title of the knowledge entry',
				displayOptions: {
					show: {
						operation: ['syncKnowledgeEntryByText'],
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
		const credentials = await this.getCredentials('symbiosikaChatApi');

		if (operation === 'checkKnowledgeItem') {
			// Check if knowledge item needs to be synced
			for (let i = 0; i < items.length; i++) {
				try {
					const externalId = this.getNodeParameter('externalId', i) as string;
					const lastChange = this.getNodeParameter('lastChange', i) as string | undefined;

					const endpoint = `${credentials.apiUrl}/api/v1/organisation/${credentials.organisationId}/ai/knowledge/sync/check`;

					const response = await this.helpers.request({
						method: 'POST',
						uri: endpoint,
						json: true,
						headers: {
							Authorization: `Bearer ${credentials.apiKey}`,
						},
						body: {
							externalId,
							lastChange,
						},
					});

					returnData.push({
						json: response,
					});
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
		} else if (operation === 'syncKnowledgeItem') {
			// Sync knowledge item
			for (let i = 0; i < items.length; i++) {
				try {
					const externalId = this.getNodeParameter('externalId', i) as string;
					const lastChange = this.getNodeParameter('lastChange', i) as string;
					const binaryPropertyName = this.getNodeParameter('binaryPropertyName', i) as string;

					const endpoint = `${credentials.apiUrl}/api/v1/organisation/${credentials.organisationId}/ai/knowledge/sync/upload`;

					// else try to use binary input
					let binaryData;
					const item = items[i];
					if (!item.binary || !item.binary[binaryPropertyName]) {
						throw new NodeOperationError(
							this.getNode(),
							`No binary data found in property "${binaryPropertyName}"`,
							{ itemIndex: i },
						);
					}
					binaryData = item.binary[binaryPropertyName];

					// Create form data
					const formData = {
						file: {
							value: Buffer.from(binaryData?.data, 'base64'),
							options: {
								filename: binaryData?.fileName || 'file',
								contentType: binaryData?.mimeType,
							},
						},
						externalId,
						lastChange,
					};

					const response = await this.helpers.request({
						method: 'POST',
						uri: endpoint,
						formData,
						json: true,
						headers: {
							Authorization: `Bearer ${credentials.apiKey}`,
						},
					});

					returnData.push({
						json: response,
					});
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
		} else if (operation === 'syncKnowledgeEntryByText') {
			// Sync knowledge entry by text
			for (let i = 0; i < items.length; i++) {
				try {
					const externalId = this.getNodeParameter('externalId', i) as string;
					const lastChange = this.getNodeParameter('lastChange', i) as string;
					const knowledgeText = this.getNodeParameter('knowledgeText', i) as string;
					const knowledgeTitle = this.getNodeParameter('knowledgeTitle', i) as string;

					const endpoint = `${credentials.apiUrl}/api/v1/organisation/${credentials.organisationId}/ai/knowledge/sync/upload`;

					const body = {
						text: knowledgeText,
						title: knowledgeTitle,
						externalId,
						lastChange,
					};

					const response = await this.helpers.request({
						method: 'POST',
						uri: endpoint,
						body,
						json: true,
						headers: {
							Authorization: `Bearer ${credentials.apiKey}`,
						},
					});

					returnData.push({
						json: response,
					});
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
