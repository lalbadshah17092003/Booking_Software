const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('🔐 Generating SSL certificates for development...');

const sslDir = path.join(__dirname, 'ssl');
const keyFile = path.join(sslDir, 'server.key');
const certFile = path.join(sslDir, 'server.cert');

// Create SSL directory if it doesn't exist
if (!fs.existsSync(sslDir)) {
  fs.mkdirSync(sslDir, { recursive: true });
  console.log('✅ Created ssl directory');
}

// Check if certificates already exist
if (fs.existsSync(keyFile) && fs.existsSync(certFile)) {
  console.log('✅ SSL certificates already exist');
  console.log(`   Key: ${keyFile}`);
  console.log(`   Cert: ${certFile}`);
  process.exit(0);
}

// Get local IP address for certificate
const networkInterfaces = os.networkInterfaces();
let localIP = 'localhost';

// Find the first non-internal IPv4 address
for (const name of Object.keys(networkInterfaces)) {
  for (const interface of networkInterfaces[name]) {
    if (interface.family === 'IPv4' && !interface.internal) {
      localIP = interface.address;
      break;
    }
  }
  if (localIP !== 'localhost') break;
}

console.log(`📍 Detected IP address: ${localIP}`);

try {
  // Generate self-signed certificate with multiple CNs
  const command = `openssl req -x509 -newkey rsa:4096 -keyout "${keyFile}" -out "${certFile}" -days 365 -nodes -subj "/C=US/ST=State/L=City/O=Organization/CN=${localIP}" -addext "subjectAltName=DNS:localhost,DNS:${localIP},IP:127.0.0.1,IP:${localIP}"`;
  
  console.log('🔧 Running openssl command...');
  execSync(command, { stdio: 'inherit' });
  
  console.log('✅ SSL certificates generated successfully!');
  console.log(`   Key: ${keyFile}`);
  console.log(`   Cert: ${certFile}`);
  console.log(`   Valid for: localhost, ${localIP}, 127.0.0.1`);
  console.log('⚠️  Note: These are self-signed certificates for development only.');
  console.log('   For production, use proper SSL certificates from a trusted CA.');
  
} catch (error) {
  console.error('❌ Failed to generate SSL certificates:', error.message);
  console.log('');
  console.log('Manual steps to generate certificates:');
  console.log('1. Open terminal/command prompt');
  console.log('2. Navigate to the backend directory');
  console.log('3. Run: openssl req -x509 -newkey rsa:4096 -keyout ssl/server.key -out ssl/server.cert -days 365 -nodes -subj "/C=US/ST=State/L=City/O=Organization/CN=192.168.0.150" -addext "subjectAltName=DNS:localhost,DNS:192.168.0.150,IP:127.0.0.1,IP:192.168.0.150"');
  console.log('4. Follow the prompts (you can use default values for development)');
  process.exit(1);
} 