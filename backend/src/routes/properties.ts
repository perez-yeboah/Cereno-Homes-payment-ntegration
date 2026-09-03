import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { sendApplicationStatusUpdate, sendProjectUpdate } from '../services/emailService';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure Multer storage for Cloudinary
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'cereno-properties', // Optional: folder name in cloudinary
    allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
  } as any, // Cast to any to avoid strict type issues with params
});
const upload = multer({ storage });

const router = Router();
const prisma = new PrismaClient();

// ---------------------------------------------------------
// PUBLIC / CLIENT ROUTES
// ---------------------------------------------------------

// List available properties
router.get('/', async (req, res) => {
  try {
    const properties = await prisma.property.findMany({
      where: { status: 'AVAILABLE' },
    });
    res.json(properties);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch properties' });
  }
});

// Client submits interest in a property
router.post('/:id/interest', async (req, res) => {
  const { id } = req.params;
  const { clientId, submittedData } = req.body;

  try {
    const interest = await prisma.propertyInterest.create({
      data: {
        propertyId: id,
        clientId,
        submittedData,
      }
    });
    res.status(201).json(interest);
  } catch (error) {
    res.status(500).json({ error: 'Failed to submit interest' });
  }
});

// Get project updates for a property
router.get('/:id/updates', async (req, res) => {
  const { id } = req.params;
  try {
    const updates = await prisma.projectUpdate.findMany({
      where: { propertyId: id },
      orderBy: { createdAt: 'desc' }
    });
    res.json(updates);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch project updates' });
  }
});


// ---------------------------------------------------------
// ADMIN ROUTES
// ---------------------------------------------------------

// Admin creates a property
router.post('/', upload.array('images', 10), async (req, res) => {
  const { address, type, description, planTypesAvailable, requiredFormFields, basePrice, currency } = req.body;
  
  // Get paths/URLs for uploaded files
  const files = req.files as Express.Multer.File[];
  const images = files ? files.map(file => file.path) : []; // file.path will be the Cloudinary URL

  try {
    const property = await prisma.property.create({
      data: {
        address: address || null,
        type: type || null,
        description,
        images,
        planTypesAvailable: planTypesAvailable ? JSON.parse(planTypesAvailable as string) : [],
        requiredFormFields: requiredFormFields ? JSON.parse(requiredFormFields as string) : {},
        basePrice: parseFloat(basePrice as string),
        currency: currency || 'GHS',
      }
    });
    res.status(201).json(property);
  } catch (error) {
    console.error('Error creating property:', error);
    res.status(500).json({ error: 'Failed to create property' });
  }
});

// Admin views all property interests
router.get('/interests/all', async (req, res) => {
  try {
    const interests = await prisma.propertyInterest.findMany({
      include: { client: true, property: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(interests);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch interests' });
  }
});

// Admin updates interest status (Approve/Reject)
router.post('/interests/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // 'APPROVED' | 'REJECTED'

  try {
    const interest = await prisma.propertyInterest.update({
      where: { id },
      data: { status },
      include: { client: true, property: true }
    });

    if (interest.client?.email) {
      await sendApplicationStatusUpdate(interest.client.email, status, interest.property.address || 'Unknown Address');
    }

    res.json(interest);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update interest status' });
  }
});

// Admin posts a project update
router.post('/:id/updates', async (req, res) => {
  const { id } = req.params;
  const { title, content } = req.body;

  try {
    const update = await prisma.projectUpdate.create({
      data: {
        propertyId: id,
        title,
        content
      },
      include: { property: true }
    });

    // Find all clients interested in or with active plans for this property to notify them
    // 1. Get interested clients
    const interests = await prisma.propertyInterest.findMany({
      where: { propertyId: id },
      include: { client: true }
    });
    
    // 2. Get active plan clients
    const plans = await prisma.paymentPlan.findMany({
      where: { propertyId: id },
      include: { client: true }
    });

    // Compile unique client emails
    const emailsToNotify = new Set<string>();
    interests.forEach(i => { if (i.client?.email) emailsToNotify.add(i.client.email); });
    plans.forEach(p => { if (p.client?.email) emailsToNotify.add(p.client.email); });

    // Send emails (in production, use a batch/queue system)
    Array.from(emailsToNotify).forEach(async (email) => {
       await sendProjectUpdate(email, title, content);
    });

    res.status(201).json(update);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create project update' });
  }
});

export default router;
