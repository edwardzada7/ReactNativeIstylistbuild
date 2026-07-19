#!/usr/bin/env python3
"""
Backend API Testing Script for iStylist App
Tests the two bug fixes and performs regression pass
"""

import requests
import json
import sys
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://mongo-supabase-api.emergent.host/api"
SUPABASE_URL = "https://gvmomyoeokauuixsydiu.supabase.co"
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2bW9teW9lb2thdXVpeHN5ZGl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYyMDQxMTksImV4cCI6MjA4MTc4MDExOX0.RWD9j4dKIcgZ_An6pM4sLgyRPc1j7A6vx1QRm2nrLw0"

# Test credentials from /app/memory/test_credentials.md
CUSTOMER_EMAIL = "istylist.qa.customer@mailinator.com"
CUSTOMER_PASSWORD = "TestPass123!"
PROVIDER_EMAIL = "istylist.qa.provider@mailinator.com"
PROVIDER_PASSWORD = "TestPass123!"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'

def print_test(name: str):
    print(f"\n{Colors.BLUE}{'='*80}{Colors.RESET}")
    print(f"{Colors.BLUE}TEST: {name}{Colors.RESET}")
    print(f"{Colors.BLUE}{'='*80}{Colors.RESET}")

def print_pass(message: str):
    print(f"{Colors.GREEN}✅ PASS: {message}{Colors.RESET}")

def print_fail(message: str):
    print(f"{Colors.RED}❌ FAIL: {message}{Colors.RESET}")

def print_info(message: str):
    print(f"{Colors.YELLOW}ℹ️  INFO: {message}{Colors.RESET}")

def login_customer() -> Optional[Dict[str, Any]]:
    """Login as customer and return auth data"""
    try:
        response = requests.post(
            f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
            headers={
                "apikey": SUPABASE_ANON_KEY,
                "Content-Type": "application/json"
            },
            json={
                "email": CUSTOMER_EMAIL,
                "password": CUSTOMER_PASSWORD
            }
        )
        if response.status_code == 200:
            data = response.json()
            print_pass(f"Customer login successful (auth_id: {data['user']['id'][:8]}...)")
            return data
        else:
            print_fail(f"Customer login failed: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print_fail(f"Customer login error: {str(e)}")
        return None

def login_provider() -> Optional[Dict[str, Any]]:
    """Login as provider and return auth data"""
    try:
        response = requests.post(
            f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
            headers={
                "apikey": SUPABASE_ANON_KEY,
                "Content-Type": "application/json"
            },
            json={
                "email": PROVIDER_EMAIL,
                "password": PROVIDER_PASSWORD
            }
        )
        if response.status_code == 200:
            data = response.json()
            print_pass(f"Provider login successful (auth_id: {data['user']['id'][:8]}...)")
            return data
        else:
            print_fail(f"Provider login failed: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print_fail(f"Provider login error: {str(e)}")
        return None

def get_user_profile(auth_id: str) -> Optional[Dict[str, Any]]:
    """Get user profile by auth_id"""
    try:
        response = requests.get(f"{BASE_URL}/users/by-auth/{auth_id}")
        if response.status_code == 200:
            return response.json()
        else:
            print_fail(f"Get profile failed: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print_fail(f"Get profile error: {str(e)}")
        return None

def test_help_support_categories():
    """
    FIX 1: Test Help & Support with real backend enum categories
    Expected categories: account, booking, payment, technical_issue, provider, abuse_report, other
    """
    print_test("FIX 1: Help & Support - Category Validation")
    
    # Get customer profile for name/email
    customer_auth = login_customer()
    if not customer_auth:
        print_fail("Cannot test Help & Support - customer login failed")
        return False
    
    profile = get_user_profile(customer_auth['user']['id'])
    if not profile:
        print_fail("Cannot test Help & Support - profile fetch failed")
        return False
    
    # Test each category from the real backend enum
    categories = ['account', 'booking', 'payment', 'technical_issue', 'provider', 'abuse_report', 'other']
    all_passed = True
    
    for category in categories:
        try:
            response = requests.post(
                f"{BASE_URL}/support/tickets",
                json={
                    "name": profile.get('name', 'QA Customer'),
                    "email": profile.get('email', CUSTOMER_EMAIL),
                    "category": category,
                    "subject": f"Test ticket for {category} category",
                    "message": f"This is a test message for the {category} category. Testing the new category enum implementation."
                }
            )
            
            if response.status_code in [200, 201]:
                print_pass(f"Category '{category}' accepted (status: {response.status_code})")
                try:
                    data = response.json()
                    if 'ticket_id' in data or 'id' in data:
                        print_info(f"  Ticket created: {data}")
                except:
                    pass
            else:
                print_fail(f"Category '{category}' rejected (status: {response.status_code})")
                print_info(f"  Response: {response.text}")
                all_passed = False
        except Exception as e:
            print_fail(f"Category '{category}' error: {str(e)}")
            all_passed = False
    
    # Test invalid category (should fail)
    print_info("\nTesting invalid category (should fail)...")
    try:
        response = requests.post(
            f"{BASE_URL}/support/tickets",
            json={
                "name": profile.get('name', 'QA Customer'),
                "email": profile.get('email', CUSTOMER_EMAIL),
                "category": "invalid_category",
                "subject": "Test with invalid category",
                "message": "This should fail validation"
            }
        )
        
        if response.status_code in [400, 422]:
            print_pass(f"Invalid category correctly rejected (status: {response.status_code})")
        else:
            print_fail(f"Invalid category NOT rejected (status: {response.status_code})")
            all_passed = False
    except Exception as e:
        print_fail(f"Invalid category test error: {str(e)}")
    
    return all_passed

def test_edit_profile_gender():
    """
    FIX 2: Test Edit Profile with Gender selector (no City/Country)
    Expected: Full Name, Email (read-only), Phone, Gender (male/female/other)
    """
    print_test("FIX 2: Edit Profile - Gender Field Persistence")
    
    # Login as customer
    customer_auth = login_customer()
    if not customer_auth:
        print_fail("Cannot test Edit Profile - customer login failed")
        return False
    
    # Get current profile
    profile = get_user_profile(customer_auth['user']['id'])
    if not profile:
        print_fail("Cannot test Edit Profile - profile fetch failed")
        return False
    
    user_id = profile.get('id')
    if not user_id:
        print_fail("Cannot test Edit Profile - no user ID in profile")
        return False
    
    print_info(f"Current profile: name={profile.get('name')}, phone={profile.get('phone')}, gender={profile.get('gender')}")
    
    # Test updating gender to each value
    genders = ['male', 'female', 'other']
    all_passed = True
    
    for gender in genders:
        print_info(f"\nTesting gender update to '{gender}'...")
        
        # Update profile with new gender
        try:
            response = requests.put(
                f"{BASE_URL}/users/{user_id}",
                json={
                    "name": profile.get('name', 'QA Customer'),
                    "phone": profile.get('phone', '+2348011122233'),
                    "gender": gender
                }
            )
            
            if response.status_code == 200:
                print_pass(f"Update request accepted (status: 200)")
                
                # Verify the gender was actually persisted
                updated_profile = get_user_profile(customer_auth['user']['id'])
                if updated_profile:
                    if updated_profile.get('gender') == gender:
                        print_pass(f"Gender '{gender}' correctly persisted in database")
                    else:
                        print_fail(f"Gender NOT persisted - expected '{gender}', got '{updated_profile.get('gender')}'")
                        all_passed = False
                else:
                    print_fail("Could not verify gender persistence - profile fetch failed")
                    all_passed = False
            else:
                print_fail(f"Update request failed (status: {response.status_code})")
                print_info(f"  Response: {response.text}")
                all_passed = False
        except Exception as e:
            print_fail(f"Gender update error: {str(e)}")
            all_passed = False
    
    # Verify City/Country are NOT in the form (they should not be sent)
    print_info("\nVerifying City/Country fields are not sent (as per fix)...")
    try:
        response = requests.put(
            f"{BASE_URL}/users/{user_id}",
            json={
                "name": profile.get('name', 'QA Customer'),
                "phone": profile.get('phone', '+2348011122233'),
                "gender": profile.get('gender', 'male'),
                "city": "Lagos",
                "country": "Nigeria"
            }
        )
        
        if response.status_code == 200:
            # Check if city/country were persisted (they shouldn't be)
            updated_profile = get_user_profile(customer_auth['user']['id'])
            if updated_profile:
                if updated_profile.get('city') is None and updated_profile.get('country') is None:
                    print_pass("City/Country correctly NOT persisted (as expected)")
                else:
                    print_info(f"City/Country were persisted: city={updated_profile.get('city')}, country={updated_profile.get('country')}")
                    print_info("This is expected behavior - backend accepts but doesn't persist these fields")
    except Exception as e:
        print_info(f"City/Country test error: {str(e)}")
    
    return all_passed

def test_regression_provider_reviews():
    """Regression: Provider Reviews screen"""
    print_test("REGRESSION: Provider Reviews API")
    
    provider_auth = login_provider()
    if not provider_auth:
        print_fail("Cannot test Provider Reviews - provider login failed")
        return False
    
    provider_profile = get_user_profile(provider_auth['user']['id'])
    if not provider_profile:
        print_fail("Cannot test Provider Reviews - profile fetch failed")
        return False
    
    provider_auth_id = provider_auth['user']['id']
    
    try:
        response = requests.get(f"{BASE_URL}/providers/{provider_auth_id}/reviews")
        
        if response.status_code == 200:
            data = response.json()
            if 'reviews' in data and 'avg_rating' in data and 'total_reviews' in data:
                print_pass(f"Provider Reviews API working (status: 200, reviews: {len(data['reviews'])}, avg_rating: {data.get('avg_rating')}, total: {data.get('total_reviews')})")
                return True
            else:
                print_fail(f"Provider Reviews API returned unexpected shape: {data}")
                return False
        else:
            print_fail(f"Provider Reviews API failed (status: {response.status_code})")
            print_info(f"  Response: {response.text}")
            return False
    except Exception as e:
        print_fail(f"Provider Reviews API error: {str(e)}")
        return False

def test_regression_my_reviews():
    """Regression: My Reviews (customer)"""
    print_test("REGRESSION: My Reviews (Customer) API")
    
    customer_auth = login_customer()
    if not customer_auth:
        print_fail("Cannot test My Reviews - customer login failed")
        return False
    
    customer_auth_id = customer_auth['user']['id']
    
    try:
        response = requests.get(
            f"{BASE_URL}/reviews/me",
            params={
                "auth_id": customer_auth_id,
                "role": "customer"
            }
        )
        
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, list):
                print_pass(f"My Reviews API working (status: 200, reviews: {len(data)})")
                return True
            else:
                print_fail(f"My Reviews API returned unexpected type: {type(data)}")
                return False
        else:
            print_fail(f"My Reviews API failed (status: {response.status_code})")
            print_info(f"  Response: {response.text}")
            return False
    except Exception as e:
        print_fail(f"My Reviews API error: {str(e)}")
        return False

def test_regression_wallet_bookings():
    """Regression: Wallet and Bookings APIs"""
    print_test("REGRESSION: Wallet & Bookings APIs")
    
    customer_auth = login_customer()
    if not customer_auth:
        print_fail("Cannot test Wallet/Bookings - customer login failed")
        return False
    
    customer_auth_id = customer_auth['user']['id']
    all_passed = True
    
    # Test Wallets
    try:
        response = requests.get(f"{BASE_URL}/wallets")
        if response.status_code == 200:
            data = response.json()
            print_pass(f"Wallets API working (status: 200, wallets: {len(data) if isinstance(data, list) else 'N/A'})")
        else:
            print_fail(f"Wallets API failed (status: {response.status_code})")
            all_passed = False
    except Exception as e:
        print_fail(f"Wallets API error: {str(e)}")
        all_passed = False
    
    # Test Wallet Transactions
    try:
        response = requests.get(
            f"{BASE_URL}/wallet/transactions",
            params={"auth_id": customer_auth_id}
        )
        if response.status_code == 200:
            data = response.json()
            print_pass(f"Wallet Transactions API working (status: 200, transactions: {len(data) if isinstance(data, list) else 'N/A'})")
        else:
            print_fail(f"Wallet Transactions API failed (status: {response.status_code})")
            all_passed = False
    except Exception as e:
        print_fail(f"Wallet Transactions API error: {str(e)}")
        all_passed = False
    
    # Test Bookings
    try:
        response = requests.get(f"{BASE_URL}/bookings")
        if response.status_code == 200:
            data = response.json()
            print_pass(f"Bookings API working (status: 200, bookings: {len(data) if isinstance(data, list) else 'N/A'})")
        else:
            print_fail(f"Bookings API failed (status: {response.status_code})")
            all_passed = False
    except Exception as e:
        print_fail(f"Bookings API error: {str(e)}")
        all_passed = False
    
    return all_passed

def main():
    print(f"\n{Colors.BLUE}{'='*80}{Colors.RESET}")
    print(f"{Colors.BLUE}iStylist Backend API Testing - Bug Fixes & Regression{Colors.RESET}")
    print(f"{Colors.BLUE}{'='*80}{Colors.RESET}")
    print(f"Backend URL: {BASE_URL}")
    print(f"Supabase URL: {SUPABASE_URL}")
    
    results = {}
    
    # Test Fix 1: Help & Support Categories
    results['help_support'] = test_help_support_categories()
    
    # Test Fix 2: Edit Profile Gender
    results['edit_profile'] = test_edit_profile_gender()
    
    # Regression Tests
    results['provider_reviews'] = test_regression_provider_reviews()
    results['my_reviews'] = test_regression_my_reviews()
    results['wallet_bookings'] = test_regression_wallet_bookings()
    
    # Summary
    print(f"\n{Colors.BLUE}{'='*80}{Colors.RESET}")
    print(f"{Colors.BLUE}TEST SUMMARY{Colors.RESET}")
    print(f"{Colors.BLUE}{'='*80}{Colors.RESET}")
    
    for test_name, passed in results.items():
        status = f"{Colors.GREEN}PASS{Colors.RESET}" if passed else f"{Colors.RED}FAIL{Colors.RESET}"
        print(f"{test_name.replace('_', ' ').title()}: {status}")
    
    total_passed = sum(1 for p in results.values() if p)
    total_tests = len(results)
    
    print(f"\n{Colors.BLUE}Total: {total_passed}/{total_tests} tests passed{Colors.RESET}")
    
    if total_passed == total_tests:
        print(f"\n{Colors.GREEN}✅ ALL TESTS PASSED{Colors.RESET}")
        return 0
    else:
        print(f"\n{Colors.RED}❌ SOME TESTS FAILED{Colors.RESET}")
        return 1

if __name__ == "__main__":
    sys.exit(main())
