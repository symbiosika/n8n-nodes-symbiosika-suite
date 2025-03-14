import type {
	IExecuteFunctions,
	INodeType,
	INodeTypeDescription,
	INodeExecutionData,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

// Global session store
const keyValueStore: Map<
	string,
	{
		value: string | number | boolean | object | undefined;
		updatedAt: number;
		lastUsedAt: number;
	}
> = new Map();

// Funktion zum Aufräumen alter Einträge
function cleanupExpiredEntries(maxAgeMinutes: number) {
	const now = Date.now();
	const expiryTime = now - maxAgeMinutes * 60 * 1000;

	for (const [key, entry] of keyValueStore.entries()) {
		if (entry.lastUsedAt < expiryTime) {
			keyValueStore.delete(key);
		}
	}
}

export class SymbiosikaKeyValueStore implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Symbiosika Key-Value Store',
		name: 'symbiosikaKeyValueStore',
		icon: 'file:symbiosika.svg',
		group: ['transform'],
		version: 1,
		description: 'Store and manage key-value pairs',
		defaults: {
			name: 'Symbiosika Key-Value Store',
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
						name: 'Store Value',
						value: 'storeValue',
						description: 'Store a value',
						action: 'Store a value',
					},
					{
						name: 'Get Value',
						value: 'getValue',
						description: 'Get a value by key',
						action: 'Get a value',
					},
					{
						name: 'Delete Value',
						value: 'deleteValue',
						description: 'Delete a value by key',
						action: 'Delete a value',
					},
				],
				default: 'storeValue',
			},
			{
				displayName: 'Key',
				name: 'key',
				type: 'string',
				default: '',
				description: 'A unique identifier for this key-value pair',
				required: true,
			},
			{
				displayName: 'Value',
				name: 'value',
				type: 'string',
				default: '',
				description: 'The value to store with this key',
				displayOptions: {
					show: {
						operation: ['storeValue'],
					},
				},
			},
			{
				displayName: 'Value Type',
				name: 'valueType',
				type: 'options',
				default: 'auto',
				description: 'The type of the value to store',
				displayOptions: {
					show: {
						operation: ['storeValue'],
					},
				},
				options: [
					{
						name: 'Auto-detect',
						value: 'auto',
						description: 'Automatically detect the value type',
					},
					{
						name: 'String',
						value: 'string',
						description: 'Store as string',
					},
					{
						name: 'Number',
						value: 'number',
						description: 'Store as number',
					},
					{
						name: 'Boolean',
						value: 'boolean',
						description: 'Store as boolean',
					},
					{
						name: 'Object (JSON)',
						value: 'object',
						description: 'Store as JSON object',
					},
				],
			},
			{
				displayName: 'Value Lifetime (Minutes)',
				name: 'valueLifetime',
				type: 'number',
				default: 60,
				description: 'How long a value remains valid after last use (in minutes)',
				displayOptions: {
					show: {
						operation: ['storeValue', 'getValue'],
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
				const key = this.getNodeParameter('key', i) as string;

				if (!key) {
					throw new NodeOperationError(this.getNode(), 'No key provided', { itemIndex: i });
				}

				let result: any = { key };

				// Validiere valueLifetime, falls verwendet
				let valueLifetime = 60; // Standardwert
				if (operation === 'storeValue' || operation === 'getValue') {
					valueLifetime = this.getNodeParameter('valueLifetime', i) as number;
					if (valueLifetime <= 0) {
						valueLifetime = 60; // Setze auf Standardwert, wenn ungültig
					}
				}

				// Regelmäßiges Aufräumen des Stores
				cleanupExpiredEntries(valueLifetime);

				if (operation === 'storeValue') {
					// Get value from parameter
					const value = this.getNodeParameter('value', i, '');
					const valueType = this.getNodeParameter('valueType', i, 'auto') as string;

					let processedValue: string | number | boolean | object | undefined;

					// Process the value based on the selected type
					if (valueType === 'auto') {
						// Try to auto-detect the type
						if (!value || value == null || value === '') {
							processedValue = undefined;
						} else if (value === 'true') {
							processedValue = true;
						} else if (value === 'false') {
							processedValue = false;
						} else if (!isNaN(Number(value))) {
							processedValue = Number(value);
						} else {
							try {
								// Try to parse as JSON
								processedValue = JSON.parse(value as string);
							} catch (e) {
								// If not valid JSON, store as string
								processedValue = value as string;
							}
						}
					}
					// explicitly set type
					else if (valueType === 'string') {
						if (value && typeof value === 'string') {
							processedValue = value;
						} else {
							processedValue = undefined;
						}
					} else if (valueType === 'number') {
						if (isNaN(Number(value))) {
							processedValue = undefined;
						} else {
							processedValue = Number(value);
						}
					} else if (valueType === 'boolean') {
						if (value && typeof value === 'string' && value.toLowerCase() === 'true') {
							processedValue = true;
						} else if (value && typeof value === 'string' && value.toLowerCase() === 'false') {
							processedValue = false;
						} else {
							processedValue = undefined;
						}
					} else if (valueType === 'object') {
						try {
							processedValue = JSON.parse(value as string);
						} catch (e) {
							processedValue = undefined;
						}
					}

					// Store the value
					result.value = processedValue;

					if (processedValue != null) {
						keyValueStore.set(key, {
							value: processedValue,
							updatedAt: Date.now(),
							lastUsedAt: Date.now(),
						});
						result.operation = 'stored';
					}
					// else drop the value
					else {
						keyValueStore.delete(key);
						result.operation = 'dropped';
					}
				} else if (operation === 'getValue') {
					if (keyValueStore.has(key)) {
						const value = keyValueStore.get(key);
						if (value && value.lastUsedAt > Date.now() - valueLifetime * 60 * 1000) {
							// Aktualisiere lastUsedAt beim Abrufen
							keyValueStore.set(key, {
								...value,
								lastUsedAt: Date.now(),
							});

							result.operation = 'retrieved';
							result.value = value.value;
							result.exists = true;
						} else {
							result.operation = 'expired';
							result.exists = false;
							// Lösche abgelaufene Einträge
							keyValueStore.delete(key);
						}
					} else {
						result.operation = 'not_found';
						result.exists = false;
					}
				} else if (operation === 'deleteValue') {
					const existed = keyValueStore.has(key);
					keyValueStore.delete(key);
					result.operation = 'deleted';
					result.existed = existed;
				}

				// Pass through original data plus our result
				const newItem: INodeExecutionData = {
					json: result,
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
