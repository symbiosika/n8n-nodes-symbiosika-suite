import type {
	INodeType,
	INodeTypeDescription,
	INodeExecutionData,
	IExecuteFunctions,
	NodeConnectionType,
} from 'n8n-workflow';

export class SymbiosikaWebhookResponse implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Symbiosika Webhook Response',
		name: 'symbiosikaWebhookResponse',
		icon: 'file:symbiosika.svg',
		group: ['response'],
		version: 1,
		description: 'Sets the response for a Symbiosika webhook',
		defaults: {
			name: 'Symbiosika Webhook Response',
		},
		inputs: ['main' as NodeConnectionType],
		outputs: ['main' as NodeConnectionType],
		properties: [
			{
				displayName: 'Status Code',
				name: 'statusCode',
				type: 'number',
				default: 200,
				description: 'HTTP status code to return',
			},
			{
				displayName: 'Response Body',
				name: 'responseBody',
				type: 'json',
				default: '{}',
				description: 'JSON response body to return',
			},
			{
				displayName: 'Additional Headers',
				name: 'headers',
				placeholder: 'Add Header',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
				},
				default: { values: [] },
				options: [
					{
						name: 'values',
						displayName: 'Header',
						values: [
							{
								displayName: 'Name',
								name: 'name',
								type: 'string',
								default: '',
								description: 'Name of the header',
							},
							{
								displayName: 'Value',
								name: 'value',
								type: 'string',
								default: '',
								description: 'Value of the header',
							},
						],
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			const statusCode = this.getNodeParameter('statusCode', i) as number;
			const responseBody = this.getNodeParameter('responseBody', i) as string;
			const headers = this.getNodeParameter('headers.values', i, []) as Array<{
				name: string;
				value: string;
			}>;

			// Get the webhook data from the global workflow data
			const workflowData = this.getWorkflowStaticData('global');

			// Set the response data
			workflowData.symbiosikaWebhookResponse = {
				statusCode,
				headers: {
					'Content-Type': 'application/json',
					...headers.reduce(
						(acc, header) => {
							acc[header.name] = header.value;
							return acc;
						},
						{} as Record<string, string>,
					),
				},
				body: responseBody,
			};

			returnData.push({
				json: items[i].json,
				pairedItem: items[i].pairedItem,
			});
		}

		return [returnData];
	}
}
