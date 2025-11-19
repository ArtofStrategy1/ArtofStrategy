import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import mammoth from "npm:mammoth@1.6.0"
import * as pdfParse from "npm:pdf-parse@1.1.1"

serve(async (req) => {
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const formData = await req.formData()
    const file = formData.get('file')
    
    if (!(file instanceof File) && !(file instanceof Blob)) {
      return new Response(JSON.stringify({ error: 'No valid file provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Get file info
    const fileName = file.name || 'unknown'
    const fileType = file.type || ''
    const fileExtension = fileName.split('.').pop()?.toLowerCase() || ''

    console.log('Processing file:', { fileName, fileType, fileExtension })

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = new Uint8Array(arrayBuffer)

    let extractedText = ''
    let documentType = ''

    // Determine file type and extract text accordingly
    if (
      fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      fileExtension === 'docx'
    ) {
      // DOCX file
      documentType = 'DOCX'
      const result = await mammoth.extractRawText({ buffer })
      extractedText = result.value

    } else if (
      fileType === 'application/pdf' ||
      fileExtension === 'pdf'
    ) {
      // PDF file
      documentType = 'PDF'
      const pdfData = await pdfParse.default(buffer)
      extractedText = pdfData.text

    } else if (
      fileType === 'text/plain' ||
      fileExtension === 'txt'
    ) {
      // Plain text file
      documentType = 'TXT'
      const decoder = new TextDecoder('utf-8')
      extractedText = decoder.decode(buffer)

    } else if (
      fileType === 'application/msword' ||
      fileExtension === 'doc'
    ) {
      // Legacy DOC file (limited support)
      documentType = 'DOC (Legacy)'
      return new Response(
        JSON.stringify({
          error: 'Legacy .doc files are not fully supported. Please convert to .docx format.',
          fileName: fileName,
          suggestion: 'Convert to DOCX for better compatibility'
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      )

    } else if (
      fileType === 'application/rtf' ||
      fileType === 'text/rtf' ||
      fileExtension === 'rtf'
    ) {
      // RTF file - basic text extraction
      documentType = 'RTF'
      const decoder = new TextDecoder('utf-8')
      let rtfContent = decoder.decode(buffer)
      // Very basic RTF to text conversion (strip RTF commands)
      extractedText = rtfContent
        .replace(/\\[a-z]+\d*\s?/g, '') // Remove RTF commands
        .replace(/[{}]/g, '') // Remove braces
        .replace(/\\/g, '') // Remove backslashes
        .trim()

    } else if (
      fileExtension === 'md' ||
      fileExtension === 'markdown'
    ) {
      // Markdown file
      documentType = 'Markdown'
      const decoder = new TextDecoder('utf-8')
      extractedText = decoder.decode(buffer)

    } else if (
      fileType === 'text/csv' ||
      fileExtension === 'csv'
    ) {
      // CSV file
      documentType = 'CSV'
      const decoder = new TextDecoder('utf-8')
      extractedText = decoder.decode(buffer)

    } else if (
      fileType === 'application/json' ||
      fileExtension === 'json'
    ) {
      // JSON file
      documentType = 'JSON'
      const decoder = new TextDecoder('utf-8')
      extractedText = decoder.decode(buffer)

    } else if (
      fileType === 'text/html' ||
      fileExtension === 'html' ||
      fileExtension === 'htm'
    ) {
      // HTML file - basic text extraction
      documentType = 'HTML'
      const decoder = new TextDecoder('utf-8')
      const htmlContent = decoder.decode(buffer)
      // Strip HTML tags (basic approach)
      extractedText = htmlContent
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()

    } else if (
      fileType === 'application/xml' ||
      fileType === 'text/xml' ||
      fileExtension === 'xml'
    ) {
      // XML file
      documentType = 'XML'
      const decoder = new TextDecoder('utf-8')
      extractedText = decoder.decode(buffer)

    } else {
      // Unsupported file type
      return new Response(
        JSON.stringify({
          error: 'Unsupported file type',
          fileName: fileName,
          fileType: fileType,
          fileExtension: fileExtension,
          supportedFormats: ['DOCX', 'PDF', 'TXT', 'RTF', 'MD', 'CSV', 'JSON', 'HTML', 'XML']
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        text: extractedText,
        fileName: fileName,
        documentType: documentType,
        fileSize: buffer.length,
        textLength: extractedText.length
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        stack: error.stack 
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
})