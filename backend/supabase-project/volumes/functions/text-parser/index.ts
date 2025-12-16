/**
 * -----------------------------------------------------------------------------
 * @name        text-parser
 * @description Securely receives multipart/form-data containing a document 
 * file, verifies the user's identity, and extracts clean, raw text content 
 * for subsequent AI/database processing (e.g., embedding generation).
 * -----------------------------------------------------------------------------
 * @method      POST
 * @base_url    /functions/v1/text-parser
 * -----------------------------------------------------------------------------
 * @security    JWT Authentication is required. Uses the Anon Key pattern, 
 * leveraging the user's JWT to verify access before starting resource-intensive 
 * file processing. Includes detailed logging for performance tracking.
 * @file_formats_supported
 * - **DOCX (.docx):** Uses the 'mammoth' NPM library.
 * - **PDF (.pdf):** Uses the 'pdf-parse' NPM library.
 * - **Structured Data (.csv, .json, .xml):** Extracts raw text/string content.
 * - **Various Text (.txt, .md, .rtf, .html):** Strips formatting for raw text content.
 * @payload     multipart/form-data (Must include 'file' field)
 * @returns     { success: true, text: string, documentType: string, ... }
 * -----------------------------------------------------------------------------
 * @env         SUPABASE_URL, SUPABASE_ANON_KEY
 * @npm_deps    mammoth, pdf-parse
 * @author      Elijah Furlonge
 * -----------------------------------------------------------------------------
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import mammoth from "npm:mammoth@1.6.0"
import * as pdfParse from "npm:pdf-parse@1.1.1"

// Debug logging utility
const debug = {
  log: (category: string, message: string, data?: any) => {
    const timestamp = new Date().toISOString()
    const logEntry = {
      timestamp,
      category,
      message,
      data: data ? JSON.stringify(data, null, 2) : undefined
    }
    console.log(`[${timestamp}] [${category.toUpperCase()}] ${message}`, data ? '\n' + JSON.stringify(data, null, 2) : '')
  },
  error: (category: string, error: Error, context?: any) => {
    const timestamp = new Date().toISOString()
    console.error(`[${timestamp}] [${category.toUpperCase()}] ERROR: ${error.message}`)
    console.error(`Stack trace:`, error.stack)
    if (context) {
      console.error(`Context:`, JSON.stringify(context, null, 2))
    }
  },
  performance: (label: string, startTime: number) => {
    const endTime = performance.now()
    const duration = endTime - startTime
    console.log(`[PERFORMANCE] ${label}: ${duration.toFixed(2)}ms`)
    return endTime
  }
}

serve(async (req) => {
  const requestStartTime = performance.now()
  const requestId = crypto.randomUUID().substring(0, 8)
  
  debug.log('request', `Starting request processing`, { 
    requestId,
    method: req.method,
    url: req.url,
    headers: Object.fromEntries(req.headers.entries())
  })

  try {
    // Authentication check
    debug.log('auth', 'Checking authorization header', { requestId })
    const authHeader = req.headers.get('Authorization')
    
    if (!authHeader) {
      debug.log('auth', 'No authorization header found', { requestId })
      return new Response(JSON.stringify({ 
        error: 'No authorization header',
        requestId 
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    debug.log('auth', 'Authorization header found', { 
      requestId,
      authHeaderLength: authHeader.length,
      authPrefix: authHeader.substring(0, 10) + '...'
    })

    // Supabase client initialization
    debug.log('supabase', 'Initializing Supabase client', { requestId })
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')
    
    debug.log('supabase', 'Environment variables check', {
      requestId,
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseKey,
      urlLength: supabaseUrl?.length || 0,
      keyLength: supabaseKey?.length || 0
    })

    const supabase = createClient(
      supabaseUrl ?? '',
      supabaseKey ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // User authentication
    debug.log('auth', 'Verifying user with Supabase', { requestId })
    const authStartTime = performance.now()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    debug.performance('Supabase auth check', authStartTime)
    
    if (userError) {
      debug.error('auth', userError, { requestId })
      return new Response(JSON.stringify({ 
        error: 'Authentication failed',
        details: userError.message,
        requestId 
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    if (!user) {
      debug.log('auth', 'No user found', { requestId })
      return new Response(JSON.stringify({ 
        error: 'Unauthorized - no user',
        requestId 
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    debug.log('auth', 'User authenticated successfully', {
      requestId,
      userId: user.id,
      userEmail: user.email
    })

    // Form data parsing
    debug.log('form', 'Parsing form data', { requestId })
    const formStartTime = performance.now()
    const formData = await req.formData()
    debug.performance('Form data parsing', formStartTime)
    
    const file = formData.get('file')
    
    // Log all form data fields for debugging
    const formFields: Record<string, any> = {}
    for (const [key, value] of formData.entries()) {
      if (value instanceof File) {
        formFields[key] = {
          type: 'File',
          name: value.name,
          size: value.size,
          mimeType: value.type
        }
      } else {
        formFields[key] = value
      }
    }
    
    debug.log('form', 'Form data parsed', {
      requestId,
      fieldCount: formData.entries.length,
      fields: formFields
    })
    
    if (!(file instanceof File) && !(file instanceof Blob)) {
      debug.log('file', 'Invalid file object', {
        requestId,
        fileType: typeof file,
        fileConstructor: file?.constructor?.name,
        hasFile: !!file
      })
      return new Response(JSON.stringify({ 
        error: 'No valid file provided',
        requestId,
        receivedType: typeof file
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // File information extraction
    const fileName = file.name || 'unknown'
    const fileType = file.type || ''
    const fileExtension = fileName.split('.').pop()?.toLowerCase() || ''
    const fileSize = file.size || 0

    debug.log('file', 'File information extracted', {
      requestId,
      fileName,
      fileType,
      fileExtension,
      fileSize,
      fileSizeMB: (fileSize / 1024 / 1024).toFixed(2)
    })

    // File buffer conversion
    debug.log('file', 'Converting file to buffer', { requestId })
    const bufferStartTime = performance.now()
    const arrayBuffer = await file.arrayBuffer()
    const buffer = new Uint8Array(arrayBuffer)
    debug.performance('File buffer conversion', bufferStartTime)
    
    debug.log('file', 'Buffer created', {
      requestId,
      bufferLength: buffer.length,
      arrayBufferSize: arrayBuffer.byteLength
    })

    let extractedText = ''
    let documentType = ''
    let processingDetails = {}

    // File type detection and processing
    debug.log('processing', 'Starting text extraction', {
      requestId,
      fileType,
      fileExtension
    })

    const extractionStartTime = performance.now()

    if (
      fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      fileExtension === 'docx'
    ) {
      // DOCX file
      documentType = 'DOCX'
      debug.log('processing', 'Processing DOCX file', { requestId })
      
      try {
        const mammothStartTime = performance.now()
        const result = await mammoth.extractRawText({ buffer })
        debug.performance('Mammoth text extraction', mammothStartTime)
        
        extractedText = result.value
        processingDetails = {
          mammothMessages: result.messages,
          warningsCount: result.messages?.filter((m: any) => m.type === 'warning').length || 0
        }
        
        debug.log('processing', 'DOCX processing completed', {
          requestId,
          textLength: extractedText.length,
          processingDetails
        })
      } catch (mammothError) {
        debug.error('processing', mammothError as Error, { requestId, documentType })
        throw new Error(`DOCX processing failed: ${(mammothError as Error).message}`)
      }

    } else if (
      fileType === 'application/pdf' ||
      fileExtension === 'pdf'
    ) {
      // PDF file
      documentType = 'PDF'
      debug.log('processing', 'Processing PDF file', { requestId })
      
      try {
        const pdfStartTime = performance.now()
        const pdfData = await pdfParse.default(buffer)
        debug.performance('PDF parsing', pdfStartTime)
        
        extractedText = pdfData.text
        processingDetails = {
          pages: pdfData.numpages,
          info: pdfData.info,
          metadata: pdfData.metadata
        }
        
        debug.log('processing', 'PDF processing completed', {
          requestId,
          textLength: extractedText.length,
          processingDetails
        })
      } catch (pdfError) {
        debug.error('processing', pdfError as Error, { requestId, documentType })
        throw new Error(`PDF processing failed: ${(pdfError as Error).message}`)
      }

    } else if (
      fileType === 'text/plain' ||
      fileExtension === 'txt'
    ) {
      // Plain text file
      documentType = 'TXT'
      debug.log('processing', 'Processing plain text file', { requestId })
      
      try {
        const decoder = new TextDecoder('utf-8')
        extractedText = decoder.decode(buffer)
        processingDetails = {
          encoding: 'utf-8',
          originalSize: buffer.length
        }
        
        debug.log('processing', 'Text file processing completed', {
          requestId,
          textLength: extractedText.length,
          processingDetails
        })
      } catch (textError) {
        debug.error('processing', textError as Error, { requestId, documentType })
        throw new Error(`Text processing failed: ${(textError as Error).message}`)
      }

    } else if (
      fileType === 'application/msword' ||
      fileExtension === 'doc'
    ) {
      // Legacy DOC file (limited support)
      documentType = 'DOC (Legacy)'
      debug.log('processing', 'Legacy DOC file detected - not supported', { requestId })
      
      return new Response(
        JSON.stringify({
          error: 'Legacy .doc files are not fully supported. Please convert to .docx format.',
          fileName: fileName,
          suggestion: 'Convert to DOCX for better compatibility',
          requestId
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
      debug.log('processing', 'Processing RTF file', { requestId })
      
      try {
        const decoder = new TextDecoder('utf-8')
        let rtfContent = decoder.decode(buffer)
        const originalLength = rtfContent.length
        
        // Very basic RTF to text conversion (strip RTF commands)
        extractedText = rtfContent
          .replace(/\\[a-z]+\d*\s?/g, '') // Remove RTF commands
          .replace(/[{}]/g, '') // Remove braces
          .replace(/\\/g, '') // Remove backslashes
          .trim()
        
        processingDetails = {
          originalRtfLength: originalLength,
          commandsStripped: originalLength - extractedText.length,
          encoding: 'utf-8'
        }
        
        debug.log('processing', 'RTF processing completed', {
          requestId,
          textLength: extractedText.length,
          processingDetails
        })
      } catch (rtfError) {
        debug.error('processing', rtfError as Error, { requestId, documentType })
        throw new Error(`RTF processing failed: ${(rtfError as Error).message}`)
      }

    } else if (
      fileExtension === 'md' ||
      fileExtension === 'markdown'
    ) {
      // Markdown file
      documentType = 'Markdown'
      debug.log('processing', 'Processing Markdown file', { requestId })
      
      try {
        const decoder = new TextDecoder('utf-8')
        extractedText = decoder.decode(buffer)
        processingDetails = {
          encoding: 'utf-8',
          preservesFormatting: true
        }
        
        debug.log('processing', 'Markdown processing completed', {
          requestId,
          textLength: extractedText.length,
          processingDetails
        })
      } catch (mdError) {
        debug.error('processing', mdError as Error, { requestId, documentType })
        throw new Error(`Markdown processing failed: ${(mdError as Error).message}`)
      }

    } else if (
      fileType === 'text/csv' ||
      fileExtension === 'csv'
    ) {
      // CSV file
      documentType = 'CSV'
      debug.log('processing', 'Processing CSV file', { requestId })
      
      try {
        const decoder = new TextDecoder('utf-8')
        extractedText = decoder.decode(buffer)
        const lineCount = extractedText.split('\n').length
        
        processingDetails = {
          encoding: 'utf-8',
          estimatedRows: lineCount,
          hasHeaders: lineCount > 0
        }
        
        debug.log('processing', 'CSV processing completed', {
          requestId,
          textLength: extractedText.length,
          processingDetails
        })
      } catch (csvError) {
        debug.error('processing', csvError as Error, { requestId, documentType })
        throw new Error(`CSV processing failed: ${(csvError as Error).message}`)
      }

    } else if (
      fileType === 'application/json' ||
      fileExtension === 'json'
    ) {
      // JSON file
      documentType = 'JSON'
      debug.log('processing', 'Processing JSON file', { requestId })
      
      try {
        const decoder = new TextDecoder('utf-8')
        extractedText = decoder.decode(buffer)
        
        // Validate JSON structure
        const jsonValidation = (() => {
          try {
            const parsed = JSON.parse(extractedText)
            return {
              valid: true,
              type: Array.isArray(parsed) ? 'array' : typeof parsed,
              keys: typeof parsed === 'object' && !Array.isArray(parsed) ? Object.keys(parsed).length : null
            }
          } catch {
            return { valid: false, error: 'Invalid JSON structure' }
          }
        })()
        
        processingDetails = {
          encoding: 'utf-8',
          jsonValidation
        }
        
        debug.log('processing', 'JSON processing completed', {
          requestId,
          textLength: extractedText.length,
          processingDetails
        })
      } catch (jsonError) {
        debug.error('processing', jsonError as Error, { requestId, documentType })
        throw new Error(`JSON processing failed: ${(jsonError as Error).message}`)
      }

    } else if (
      fileType === 'text/html' ||
      fileExtension === 'html' ||
      fileExtension === 'htm'
    ) {
      // HTML file - basic text extraction
      documentType = 'HTML'
      debug.log('processing', 'Processing HTML file', { requestId })
      
      try {
        const decoder = new TextDecoder('utf-8')
        const htmlContent = decoder.decode(buffer)
        const originalLength = htmlContent.length
        
        // Strip HTML tags (basic approach)
        extractedText = htmlContent
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
        
        processingDetails = {
          originalHtmlLength: originalLength,
          tagsStripped: originalLength - extractedText.length,
          encoding: 'utf-8'
        }
        
        debug.log('processing', 'HTML processing completed', {
          requestId,
          textLength: extractedText.length,
          processingDetails
        })
      } catch (htmlError) {
        debug.error('processing', htmlError as Error, { requestId, documentType })
        throw new Error(`HTML processing failed: ${(htmlError as Error).message}`)
      }

    } else if (
      fileType === 'application/xml' ||
      fileType === 'text/xml' ||
      fileExtension === 'xml'
    ) {
      // XML file
      documentType = 'XML'
      debug.log('processing', 'Processing XML file', { requestId })
      
      try {
        const decoder = new TextDecoder('utf-8')
        extractedText = decoder.decode(buffer)
        processingDetails = {
          encoding: 'utf-8',
          preservesStructure: true
        }
        
        debug.log('processing', 'XML processing completed', {
          requestId,
          textLength: extractedText.length,
          processingDetails
        })
      } catch (xmlError) {
        debug.error('processing', xmlError as Error, { requestId, documentType })
        throw new Error(`XML processing failed: ${(xmlError as Error).message}`)
      }

    } else {
      // Unsupported file type
      debug.log('processing', 'Unsupported file type detected', {
        requestId,
        fileName,
        fileType,
        fileExtension
      })
      
      return new Response(
        JSON.stringify({
          error: 'Unsupported file type',
          fileName: fileName,
          fileType: fileType,
          fileExtension: fileExtension,
          supportedFormats: ['DOCX', 'PDF', 'TXT', 'RTF', 'MD', 'CSV', 'JSON', 'HTML', 'XML'],
          requestId
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    debug.performance('Text extraction', extractionStartTime)

    // Final response preparation
    const responseData = {
      success: true,
      text: extractedText,
      fileName: fileName,
      documentType: documentType,
      fileSize: buffer.length,
      textLength: extractedText.length,
      processingDetails,
      requestId,
      processingTime: performance.now() - requestStartTime
    }

    debug.log('response', 'Preparing successful response', {
      requestId,
      documentType,
      textLength: extractedText.length,
      fileSize: buffer.length,
      totalProcessingTime: performance.now() - requestStartTime
    })

    debug.performance('Total request processing', requestStartTime)

    return new Response(
      JSON.stringify(responseData),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    debug.error('request', error as Error, { 
      requestId,
      totalTime: performance.now() - requestStartTime
    })
    
    return new Response(
      JSON.stringify({ 
        error: (error as Error).message,
        stack: (error as Error).stack,
        requestId,
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
})