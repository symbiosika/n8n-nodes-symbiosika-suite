import type {
	IExecuteFunctions,
	INodeType,
	INodeTypeDescription,
	INodeExecutionData,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

// Session store type
type ChatSession = {
	chatId: string;
	lastUsed: Date;
};

// Global session store
const sessionStore: Map<string, ChatSession> = new Map();

export class SymbiosikaChatSessionStore implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Symbiosika Chat Session Store',
		name: 'symbiosikaChatSessionStore',
		icon: 'file:symbiosika.svg',
		group: ['transform'],
		version: 1,
		description: 'Store and manage Symbiosika chat sessions',
		defaults: {
			name: 'Symbiosika Chat Session Store',
		},
		inputs: ['main'] as any,
		outputs: ['main'] as any,
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Store Session',
						value: 'storeSession',
						description: 'Store a chat session',
						action: 'Store a chat session',
					},
					{
						name: 'Get Session',
						value: 'getSession',
						description: 'Get a chat session by ID',
						action: 'Get a chat session',
					},
					{
						name: 'Delete Session',
						value: 'deleteSession',
						description: 'Delete a chat session',
						action: 'Delete a chat session',
					},
				],
				default: 'storeSession',
			},
			{
				displayName: 'Session ID',
				name: 'sessionId',
				type: 'string',
				default: '',
				description: 'A unique identifier for this chat session',
				required: true,
			},
			{
				displayName: 'Chat ID',
				name: 'chatId',
				type: 'string',
				default: '',
				description: 'The chat ID to store with this session',
				displayOptions: {
					show: {
						operation: ['storeSession'],
					},
				},
			},
			{
				displayName: 'Session Duration (Minutes)',
				name: 'sessionDuration',
				type: 'number',
				default: 60,
				description: 'How long a session remains valid after last use (in minutes)',
				displayOptions: {
					show: {
						operation: ['storeSession', 'getSession'],
					},
				},
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const operation = this.getNodeParameter('operation', 0) as string;

		for (let i = 0; i < items.length; i++) {
			try {
				const sessionId = this.getNodeParameter('sessionId', i) as string;

				if (!sessionId) {
					throw new NodeOperationError(this.getNode(), 'No session ID provided', { itemIndex: i });
				}

				let result: any = { sessionId };

				if (operation === 'storeSession') {
					// Get chat ID from parameter or input
					let chatId = this.getNodeParameter('chatId', i, '') as string;

					// If no explicit chatId is provided, check if it's in the input data
					if (!chatId && items[i].json.chatId) {
						chatId = items[i].json.chatId as string;
					}

					if (!chatId) {
						throw new NodeOperationError(
							this.getNode(),
							'No chat ID provided for storing session',
							{
								itemIndex: i,
							},
						);
					}

					// Store the session
					sessionStore.set(sessionId, {
						chatId,
						lastUsed: new Date(),
					});

					result.operation = 'stored';
					result.chatId = chatId;
				} else if (operation === 'getSession') {
					const sessionDuration = this.getNodeParameter('sessionDuration', i, 60) as number;

					if (sessionStore.has(sessionId)) {
						const session = sessionStore.get(sessionId)!;
						const now = new Date();
						const sessionAgeMinutes = (now.getTime() - session.lastUsed.getTime()) / (1000 * 60);

						// Only use session if it's not expired
						if (sessionAgeMinutes < sessionDuration) {
							// Update session timestamp
							session.lastUsed = now;
							sessionStore.set(sessionId, session);

							result.operation = 'retrieved';
							result.chatId = session.chatId;
							result.lastUsed = session.lastUsed;
							result.valid = true;
						} else {
							// Remove expired session
							sessionStore.delete(sessionId);
							result.operation = 'expired';
							result.valid = false;
						}
					} else {
						result.operation = 'not_found';
						result.valid = false;
					}
				} else if (operation === 'deleteSession') {
					const existed = sessionStore.has(sessionId);
					sessionStore.delete(sessionId);
					result.operation = 'deleted';
					result.existed = existed;
				}

				// Pass through original data plus our result
				const newItem: INodeExecutionData = {
					json: {
						...items[i].json,
						...result,
					},
				};

				returnData.push(newItem);
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
