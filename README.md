# Airbyte Agora Source Connector

This connector allows you to extract data from Agora's real-time communication platform using the Airbyte data integration platform.

## Features

- Extract usage data and analytics
- Collect call quality metrics
- Track recording sessions
- Monitor channel activities
- Gather event logs and error information

## Prerequisites

- Node.js 14+
- Docker (for deployment)
- Agora account credentials (App ID, Customer ID, Customer Secret)
- Airbyte instance (self-hosted or cloud)

## Supported Data Streams

| Stream Name | Description | Incremental Sync |
|-------------|-------------|------------------|
| usage | API and bandwidth consumption metrics | ✅ |
| call_quality | Call quality metrics (latency, loss, jitter, quality scores) | ✅ |
| recordings | Recording session information | ✅ |
| channels | Channel creation and usage statistics | ✅ |
| events | System events and errors | ✅ |

## Configuration

### Airbyte Web UI Configuration

This connector can be configured through the Airbyte Web UI. When adding the connector in the Airbyte UI, you will need to provide the following information:

1. **App ID**: Your Agora App ID
2. **Customer ID**: Your Agora Customer ID
3. **Customer Secret**: Your Agora Customer Secret
4. **API Endpoint URL**: The Agora API endpoint URL (default: `https://api.agora.io`)
5. **Region**: The Agora region to use (global, na, eu, ap, or cn) (default: `global`)
6. **Start Date**: The date from which to start syncing data (format: `YYYY-MM-DD`)
7. **Streams**: The streams to sync (leave empty to sync all streams)

### Environment Variable Configuration (Legacy)

### Source Configuration

| Field | Description | Required | Default |
|-------|-------------|----------|---------|
| app_id | Agora App ID | Yes | - |
| customer_id | Agora Customer ID | Yes | - |
| customer_secret | Agora Customer Secret | Yes | - |
| endpoint_url | API endpoint URL | Yes | https://api.agora.io |
| region | Agora region | No | global |
| start_date | Historical data start date (YYYY-MM-DD) | Yes | - |
| streams | Array of stream names to synchronize | No | All streams |

### Regional Configuration

For specific regional endpoints, specify the `region` parameter with one of the following values:
- `na` (North America)
- `eu` (Europe)
- `ap` (Asia Pacific)
- `cn` (China)

## Setup Guide

### Local Development

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file with your Agora credentials
4. Run tests:
   ```bash
   npm test
   ```

### Building the Connector

```bash
docker build -t source-agora:dev .
```

### Deploying with Airbyte

See the main [deployment documentation](../docs/deployment.md) for instructions on deploying this connector with Airbyte.

## Testing the Connection

Once configured in Airbyte, you can test the connection by:

1. Adding a new source connection using the Agora connector
2. Entering your Agora credentials
3. Clicking "Test Connection"
4. If successful, you'll see a list of available streams

## Troubleshooting

### Common Issues

- **Authentication failures**: Verify your App ID, Customer ID, and Customer Secret are correct
- **Connection timeouts**: Check that your endpoint URL is reachable
- **Rate limiting**: Reduce sync frequency or batch size
- **Missing data**: Ensure the requested streams exist and contain data

### Getting Help

If you encounter issues:

1. Check the Airbyte logs for error messages
2. Refer to the [Agora API documentation](https://docs.agora.io/en/)
3. Open an issue in the GitHub repository with detailed information

## Development

### Project Structure

```
/
├── Dockerfile              # Container definition
├── package.json            # Dependencies and scripts
├── src/
│   ├── index.js            # Main entry point
│   ├── config.js           # Configuration schema and validation
│   ├── streams/            # Stream implementations
│   │   ├── base.js         # Base stream class
│   │   ├── usage.js        # Usage stream implementation
│   │   ├── call_quality.js # Call quality stream implementation
│   │   └── ...
│   └── utils/              # Utility functions
├── test/
│   ├── unit/               # Unit tests
│   └── integration/        # Integration tests
└── resources/
    ├── spec.json           # Connector specification
    └── schemas/            # JSON schemas for each stream
```

### Adding a New Stream

1. Create a new schema in `resources/schemas/`
2. Create a new stream implementation in `src/streams/`
3. Add the stream to the stream registry in `src/index.js`
4. Write tests for the new stream
5. Update documentation

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](../LICENSE) file for details.

## Contributing

We welcome contributions! Please see our [contribution guidelines](../docs/CONTRIBUTING.md) for details on how to get involved.
