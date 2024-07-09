const { DocumentProcessorServiceClient } = require('@google-cloud/documentai').v1;
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const dotenv = require('dotenv');
const { translateNDCToRXCUI } = require('../documentai-api/src/mysqlConnection');

//Util func to clean an NDC string input for a function call made later on
const cleanString = (inputString) => {
  // Remove all hyphens from the string
  const stringWithoutHyphens = inputString.replace(/-/g, '');

  // Check if the length of the modified string is 11
  if (stringWithoutHyphens.length === 11) {
    // If the length is 11, use the modified string
    return stringWithoutHyphens;
  } else {
    // If the length is less than 11, use the original string
    return inputString;
  }
};

//Loads environment variables from .env
dotenv.config();

//Initializes express app to use a specific parser for easier handling of JSON data
const app = express();
app.use(bodyParser.json({ limit: '10mb'}));
app.use(cors());

const projectId = process.env.GOOGLE_CLOUD_PROJECT;
const location = 'us'; // Format is 'us' or 'eu'
const processorId = process.env.PROCESSOR_ID;

//Creates the client for document AI to interact with their services
const client = new DocumentProcessorServiceClient();

//Use the created express app to define the processDocument endpoint
app.post('/processDocument', async (req, res) => {
  try {
    const { encodedImage, mimeType } = req.body;

    if (!encodedImage || !mimeType) {
      return res.status(400).send('Invalid request: missing encodedImage or mimeType');
    }

    const name = `projects/${projectId}/locations/${location}/processors/${processorId}`;

    const request = {
      name,
      rawDocument: {
        content: encodedImage,
        mimeType,
      },
    };

    const [result] = await client.processDocument(request);
    const { document } = result;

    //Takes the textAnchor object returned from the Document AI API
    const getText = (textAnchor) => {
      if (!textAnchor.textSegments || textAnchor.textSegments.length === 0) {
        return '';
      }

      const startIndex = textAnchor.textSegments[0].startIndex || 0;
      const endIndex = textAnchor.textSegments[0].endIndex;

      return document.text.substring(startIndex, endIndex);
    };

    //Used to keep track of individual entities scanned from the processed document
    const ndcFields = [];
    document.entities.forEach((entity) => {
      if (entity.type === 'NDC') {
        ndcFields.push(getText(entity.textAnchor));
      }
    });

    const translatedNDCs = await Promise.all(ndcFields.map(async (ndc) => {
      const validNdc = cleanString(ndc);
      const translation = await translateNDCToRXCUI(validNdc);
      return translation;
    }));

    res.json({ scannedNdcs: translatedNDCs });
  } catch (error) {
    console.error('Error processing document:', error);
    res.status(500).send('Failed to process document');
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`)
});

exports.processDocument = app;