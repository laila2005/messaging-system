# security/tls_setup.py - TLS Certificate Generation and Configuration
"""
TLS setup for secure chat communication.

This module provides:
- Self-signed certificate generation for development
- TLS context configuration
- Certificate validation utilities

For production, use certificates from a proper CA like Let's Encrypt.
"""

import ssl
import socket
import os
from pathlib import Path

class TLSConfig:
    """TLS configuration for secure communication."""
    
    def __init__(self, cert_file=None, key_file=None):
        """
        Initialize TLS configuration.
        
        Args:
            cert_file (str): Path to certificate file
            key_file (str): Path to private key file
        """
        self.cert_dir = Path("certificates")
        self.cert_file = cert_file or self.cert_dir / "server.crt"
        self.key_file = key_file or self.cert_dir / "server.key"
        
        # Create certificates directory if it doesn't exist
        self.cert_dir.mkdir(exist_ok=True)
    
    def generate_self_signed_cert(self):
        """
        Generate self-signed certificate for development/testing.
        
        WARNING: Use only for development! For production, use proper CA certificates.
        """
        try:
            from cryptography import x509
            from cryptography.x509.oid import NameOID
            from cryptography.hazmat.primitives import hashes, serialization
            from cryptography.hazmat.primitives.asymmetric import rsa
            import ipaddress
            import datetime
            
            # Generate private key
            private_key = rsa.generate_private_key(
                public_exponent=65537,
                key_size=2048,
            )
            
            # Get local IP addresses for certificate
            hostname = socket.gethostname()
            local_ip = socket.gethostbyname(hostname)
            
            # Create certificate
            subject = issuer = x509.Name([
                x509.NameAttribute(NameOID.COUNTRY_NAME, "US"),
                x509.NameAttribute(NameOID.STATE_OR_PROVINCE_NAME, "CA"),
                x509.NameAttribute(NameOID.LOCALITY_NAME, "San Francisco"),
                x509.NameAttribute(NameOID.ORGANIZATION_NAME, "Chat System"),
                x509.NameAttribute(NameOID.COMMON_NAME, hostname),
            ])
            
            cert = x509.CertificateBuilder().subject_name(
                subject
            ).issuer_name(
                issuer
            ).public_key(
                private_key.public_key()
            ).serial_number(
                x509.random_serial_number()
            ).not_valid_before(
                datetime.datetime.utcnow()
            ).not_valid_after(
                datetime.datetime.utcnow() + datetime.timedelta(days=365)
            ).add_extension(
                x509.SubjectAlternativeName([
                    x509.DNSName(hostname),
                    x509.DNSName("localhost"),
                    x509.IPAddress(ipaddress.IPv4Address("127.0.0.1")),
                    x509.IPAddress(ipaddress.IPv4Address(local_ip)),
                ]),
                critical=False,
            ).sign(private_key, hashes.SHA256())
            
            # Write certificate to file
            with open(self.cert_file, "wb") as f:
                f.write(cert.public_bytes(serialization.Encoding.PEM))
            
            # Write private key to file
            with open(self.key_file, "wb") as f:
                f.write(private_key.private_bytes(
                    encoding=serialization.Encoding.PEM,
                    format=serialization.PrivateFormat.PKCS8,
                    encryption_algorithm=serialization.NoEncryption()
                ))
            
            print(f"✓ Generated self-signed certificate:")
            print(f"  Certificate: {self.cert_file}")
            print(f"  Private key: {self.key_file}")
            print(f"  Hostname: {hostname}")
            print(f"  Local IP: {local_ip}")
            print("\n⚠️  WARNING: Self-signed certificate for development only!")
            print("   For production, use certificates from a proper CA.")
            
            return True
            
        except ImportError:
            print("✗ cryptography library not installed. Install with:")
            print("   pip install cryptography")
            return False
        except Exception as e:
            print(f"✗ Failed to generate certificate: {e}")
            return False
    
    def create_server_context(self):
        """
        Create SSL context for server.
        
        Returns:
            ssl.SSLContext: Configured SSL context for server
        """
        if not self.cert_file.exists() or not self.key_file.exists():
            if not self.generate_self_signed_cert():
                raise RuntimeError("Failed to generate TLS certificates")
        
        # Create SSL context for server
        context = ssl.create_default_context(ssl.Purpose.CLIENT_AUTH)
        
        # Load certificate and private key
        context.load_cert_chain(
            certfile=str(self.cert_file),
            keyfile=str(self.key_file)
        )
        
        # Configure secure cipher suites
        context.set_ciphers('ECDHE+AESGCM:ECDHE+CHACHA20:DHE+AESGCM:DHE+CHACHA20:!aNULL:!MD5:!DSS')
        
        # Require TLS 1.2 or higher
        context.minimum_version = ssl.TLSVersion.TLSv1_2
        
        # Enable perfect forward secrecy
        context.options |= ssl.OP_NO_COMPRESSION
        
        print(f"✓ Server TLS context configured")
        print(f"  Certificate: {self.cert_file}")
        print(f"  Minimum TLS version: 1.2")
        
        return context
    
    def create_client_context(self, verify=True):
        """
        Create SSL context for client.
        
        Args:
            verify (bool): Whether to verify server certificate
            
        Returns:
            ssl.SSLContext: Configured SSL context for client
        """
        # Create SSL context for client
        context = ssl.create_default_context(ssl.Purpose.SERVER_AUTH)
        
        if not verify:
            # For development with self-signed certificates
            context.check_hostname = False
            context.verify_mode = ssl.CERT_NONE
            print("⚠️  Certificate verification disabled (development mode)")
        else:
            # Load our self-signed certificate for verification
            if self.cert_file.exists():
                context.load_verify_locations(str(self.cert_file))
                print(f"✓ Using certificate for verification: {self.cert_file}")
        
        # Configure secure settings
        context.set_ciphers('ECDHE+AESGCM:ECDHE+CHACHA20:DHE+AESGCM:DHE+CHACHA20:!aNULL:!MD5:!DSS')
        context.minimum_version = ssl.TLSVersion.TLSv1_2
        context.options |= ssl.OP_NO_COMPRESSION
        
        print(f"✓ Client TLS context configured")
        
        return context
    
    def verify_certificates(self):
        """
        Verify that certificates exist and are valid.
        
        Returns:
            bool: True if certificates are valid
        """
        if not self.cert_file.exists():
            print(f"✗ Certificate file not found: {self.cert_file}")
            return False
        
        if not self.key_file.exists():
            print(f"✗ Private key file not found: {self.key_file}")
            return False
        
        try:
            # Try to create context to validate certificates
            self.create_server_context()
            print("✓ TLS certificates are valid")
            return True
        except Exception as e:
            print(f"✗ Invalid TLS certificates: {e}")
            return False


def setup_tls_for_development():
    """
    Quick setup function for development environment.
    
    Returns:
        TLSConfig: Configured TLS instance
    """
    print("Setting up TLS for development...")
    print("=" * 50)
    
    tls_config = TLSConfig()
    
    # Generate certificates if needed
    if not tls_config.verify_certificates():
        print("Generating new TLS certificates...")
        tls_config.generate_self_signed_cert()
    
    print("=" * 50)
    print("✓ TLS setup complete!")
    
    return tls_config


if __name__ == "__main__":
    # Test TLS setup
    tls_config = setup_tls_for_development()
    
    # Test creating contexts
    try:
        server_context = tls_config.create_server_context()
        client_context = tls_config.create_client_context(verify=False)
        print("\n✓ TLS contexts created successfully!")
    except Exception as e:
        print(f"\n✗ TLS context creation failed: {e}")
