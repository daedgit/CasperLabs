%define __spec_install_post %{nil}
%define __os_install_post %{_dbpath}/brp-compress
%define debug_package %{nil}

Name: casperlabs-engine-grpc-server
Summary: Wasm execution engine for CasperLabs smart contracts.
Version: @@VERSION@@
Release: @@RELEASE@@
License: CasperLabs Open Source License (COSL)
Group: Applications/System
Source0: %{name}-%{version}.tar.gz
URL: https://casperlabs.io

BuildRoot: %{_tmppath}/%{name}-%{version}-%{release}-root

%description
%{summary}

%prep
%setup -q

%install
rm -rf %{buildroot}
mkdir -p %{buildroot}
cp -a * %{buildroot}

%clean
rm -rf %{buildroot}

%files
%defattr(-,root,root,-)
%{_bindir}/*
